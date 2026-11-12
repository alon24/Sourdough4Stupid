/** Backward planner: from "bread out of the oven at T" to a list of timed steps. */
import { bakeProfile, type LoafShape } from './bake.js';
import { buildChain, type Stage } from './build.js';
import { flourName, type BlendShare } from './flours.js';
import { bulkState, type Reading } from './temp.js';
import { dough, type DoughResult, type Inclusion, type Piece } from './dough.js';
import {
  revivalFeeds,
  tempFactor,
  type Ratio,
  type StarterType,
} from './starter.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

export type StepKind =
  | 'revive' | 'feed' | 'soak' | 'autolyse' | 'mix' | 'fold' | 'divide'
  | 'shape' | 'outOfTin' | 'fridge' | 'preheat' | 'bake' | 'uncover' | 'done' | 'bakeRolls' | 'rollsDone';

export interface Step {
  id: string;
  kind: StepKind;
  title: string;
  /** epoch milliseconds */
  at: number;
  alarm: boolean;
  note?: string;
  doneAt?: number;
}

export const FOLD_WHY = 'קיפולים מחזקים את הגלוטן בלי לישה ארוכה. ברירת המחדל 4; אפשר להוסיף או להוריד לפי מגע הבצק.';

export interface PlanInput {
  /** when the loaves come out of the oven, epoch ms */
  outOfOvenAt: number;
  loaves: number;
  rolls: number;
  loafWeight?: number;
  loafShape?: LoafShape;
  rollWeight?: number;
  starter: {
    type: StarterType;
    hydration: number;
    daysInFridge: number;
    speedFactor?: number;
    /** grams you have now; the plan builds up from this with as many feedings as needed */
    haveGrams?: number;
  };
  /** grams of starter to have ready for mixing (default: what the dough needs) */
  buildTarget?: number;
  /** the starter is already built and ready: no feeding steps */
  starterReady?: boolean;
  roomTempC?: number;
  kneading: 'hand' | 'machine';
  /** kneading rounds (stretch and folds) during the bulk; default 4 */
  folds?: number;
  /** minutes between rounds; default 30 by hand, 45 by machine */
  foldGapMin?: number;
  inclusions?: (Inclusion & { soak?: boolean })[];
  /** overnight cold proof */
  coldProof?: boolean;
  /** preferred hours between the build feeding and mixing */
  feedWindowH?: number;
  hydration?: number;
  blend?: BlendShare[];
  salt?: number;
  levainPct?: number;
}

export interface Plan {
  steps: Step[];
  dough: DoughResult;
  build: { seed: number; ratio: Ratio; addFlour: number; addWater: number; hours: number };
  /** every feeding from what you have to what you need, in order */
  chain: Stage[];
  /** for temperature-aware retiming of the bulk */
  bulk: { startAt: number; refMin: number; startC: number };
  /** true when the first step is already in the past relative to `now` */
  startsInPast: boolean;
}

export function plan(input: PlanInput, now: number = Date.now()): Plan {
  const {
    outOfOvenAt, loaves, rolls, starter, kneading,
    loafWeight = 900, loafShape = 'free', rollWeight = 90, roomTempC = 24, coldProof = true,
    feedWindowH = 10, hydration = 0.72, salt = 0.02, levainPct = 0.2,
  } = input;
  const inclusions = input.inclusions ?? [];
  if (loaves < 0 || rolls < 0 || loaves + rolls === 0) throw new RangeError('nothing to bake');

  const pieces: Piece[] = [];
  if (loaves > 0) pieces.push({ name: 'loaf', count: loaves, weight: loafWeight });
  if (rolls > 0) pieces.push({ name: 'roll', count: rolls, weight: rollWeight });
  const flours = (input.blend ?? [{ id: 'white', pct: 1 }]).map((b) => ({ name: flourName(b.id), pct: b.pct }));
  const d = dough({ pieces, hydration, salt, levainPct, levainHydration: starter.hydration, inclusions, flours });

  const steps: Step[] = [];
  let n = 0;
  const add = (kind: StepKind, title: string, at: number, alarm = true, note?: string) =>
    steps.push({ id: `s${n++}`, kind, title, at, alarm, note });

  // --- bake day, walking backward from the oven ---
  const hasLoaves = loaves > 0;
  const bp = bakeProfile(loafWeight, loafShape);
  const tin = loafShape === 'tin';
  const bakeStart = outOfOvenAt - (hasLoaves ? bp.totalMin : 20) * MIN;
  if (hasLoaves) {
    add('done', 'להוציא את הלחם', outOfOvenAt, true, `מוכן כשהמרכז ב־${bp.doneCoreTemp}°`);
    if (tin) add('outOfTin', 'לחלץ מהתבנית ולהחזיר לתנור', outOfOvenAt - bp.outOfTinMin * MIN);
    add('uncover', `${tin ? 'להסיר כיסוי' : 'להוריד מכסה'} ולהנמיך ל־${bp.openTemp}°`, bakeStart + bp.coveredMin * MIN);
    add('bake', `לאפות: ${bp.coveredTemp}° מכוסה, ${bp.coveredMin} דק'`, bakeStart, true,
      tin ? 'לכסות בתבנית הפוכה או בנייר כסף, או תבנית קרח בתחתית התנור' : 'אפשר להוסיף 2-3 קוביות קרח לסיר');
    if (rolls > 0) {
      add('bakeRolls', 'לאפות לחמניות: 230° עם אדים', outOfOvenAt + 5 * MIN);
      add('rollsDone', 'להוציא את הלחמניות', outOfOvenAt + 25 * MIN);
    }
  } else {
    add('rollsDone', 'להוציא את הלחמניות', outOfOvenAt);
    add('bakeRolls', 'לאפות לחמניות: 230° עם אדים', bakeStart);
  }
  add('preheat', `לחמם תנור ל־${hasLoaves ? bp.coveredTemp : 230}°`, bakeStart - (tin ? 30 : 60) * MIN);

  const tf = tempFactor(roomTempC);
  const finalProofMs = coldProof ? 12 * HOUR : 1.5 * HOUR * tf;
  const shapeAt = bakeStart - finalProofMs;
  add('shape', tin ? (coldProof ? 'לעצב לגליל, לתבנית משומנת ולמקרר' : 'לעצב לגליל ולתבנית משומנת') : (coldProof ? 'לעצב ולמקרר' : 'לעצב'), shapeAt, true,
    tin ? 'התפחה עד שהבצק מגיע לשפת התבנית. אין צורך בחריצה' : undefined);
  const divideAt = shapeAt - 30 * MIN;
  add('divide', rolls > 0 && hasLoaves ? 'לחלק לבצק לחם ולחמניות, עיצוב מוקדם' : 'עיצוב מוקדם', divideAt);

  // bulk: 4.5 h at 24°C with 20% levain; more levain is faster
  const refMin = 270 * (0.2 / levainPct) ** 0.5;
  const bulkMs = refMin * MIN * tf;
  const mixAt = divideAt - bulkMs;
  const folds = Math.max(0, Math.min(8, Math.round(input.folds ?? 4)));
  const foldGap = (input.foldGapMin ?? (kneading === 'hand' ? 30 : 45)) * MIN;
  for (let i = folds; i >= 1; i--) {
    const withInclusions = i === 1 && inclusions.length > 0;
    add('fold', `קיפול ${i} מתוך ${folds}`, mixAt + i * foldGap, true,
      (withInclusions ? `להוסיף: ${inclusions.map((x) => x.name).join(', ')}. ` : '') + FOLD_WHY);
  }
  add('mix', 'להוסיף מחמצת ומלח', mixAt);
  const autolyseAt = mixAt - (kneading === 'hand' ? 45 : 30) * MIN;
  add('autolyse', 'אוטוליזה: קמח ומים', autolyseAt);
  const soaked = inclusions.filter((x) => x.soak);
  if (soaked.length > 0) {
    add('soak', `להשרות: ${soaked.map((x) => x.name).join(', ')}`, mixAt, false);
  }

  // --- starter build, peaking at mix time ---
  const target = Math.max(input.buildTarget ?? 0, d.levain);
  const chain: Stage[] = input.starterReady
    ? []
    : buildChain({
        have: starter.haveGrams ?? Number.MAX_SAFE_INTEGER, target,
        type: starter.type, hydration: starter.hydration,
        tempC: roomTempC, speedFactor: starter.speedFactor, windowH: feedWindowH,
      });
  const revive = revivalFeeds(starter.daysInFridge);
  let feedAt = mixAt;
  chain.forEach((st, i) => {
    const fromEnd = chain.length - 1 - i;
    const at = mixAt - chain.slice(i).reduce((sum, x) => sum + x.hours, 0) * HOUR;
    if (i === 0) feedAt = at;
    const r = st.ratio;
    const label = chain.length > 1 ? `האכלה ${i + 1} מתוך ${chain.length}` : 'להאכיל סטארטר';
    add('feed', `${label} 1:${r.a}:${+r.b.toFixed(1)}`, at, true,
      `${Math.round(st.seed)} ג' סטארטר + ${Math.round(st.addFlour)} ג' קמח + ${Math.round(st.addWater)} ג' מים` +
        (fromEnd === 0 ? ` (יוצא ${Math.round(st.total)} ג')` : ''));
  });
  if (chain.length > 0) {
    for (let i = 1; i <= revive; i++) {
      add('revive', 'האכלת חיזוק 1:3', feedAt - i * 12 * HOUR, true,
        `הסטארטר ${starter.daysInFridge} ימים במקרר`);
    }
  }
  const last = chain[chain.length - 1];
  const buildInfo = last
    ? { seed: last.seed, ratio: last.ratio, addFlour: last.addFlour, addWater: last.addWater, hours: last.hours }
    : { seed: 0, ratio: { a: 0, b: 0 }, addFlour: 0, addWater: 0, hours: 0 };

  steps.sort((x, y) => x.at - y.at);
  return {
    steps,
    dough: d,
    build: buildInfo,
    chain,
    bulk: { startAt: mixAt, refMin, startC: roomTempC },
    startsInPast: steps[0]!.at < now,
  };
}

/**
 * Move a step by `deltaMin`. With `cascade` (the default) every later step
 * that is not done moves with it; done steps never move.
 */
export function shift(steps: Step[], id: string, deltaMin: number, cascade = true): Step[] {
  const target = steps.find((s) => s.id === id);
  if (!target) throw new RangeError(`unknown step ${id}`);
  const delta = deltaMin * MIN;
  return steps
    .map((s) => {
      if (s.doneAt !== undefined) return s;
      const moves = s.id === id || (cascade && s.at > target.at);
      return moves ? { ...s, at: s.at + delta } : s;
    })
    .sort((x, y) => x.at - y.at);
}

/**
 * Mark a step done at `when`.
 * - Late: the waits that follow keep their planned length, counted from `when`,
 *   so everything after moves by the delay (a 45 min autolyse that took 75 min
 *   still leaves the planned 30 min before the next step).
 * - Early: later steps stay where they are, so the oven time holds. Use
 *   `resumeAt` ("I am here now") to pull the rest forward on purpose.
 */
export function complete(steps: Step[], id: string, when: number): Step[] {
  const target = steps.find((s) => s.id === id);
  if (!target) throw new RangeError(`unknown step ${id}`);
  const lateMin = (when - target.at) / MIN;
  const moved = lateMin > 0 ? shift(steps, id, lateMin, true) : steps;
  return moved.map((s) => (s.id === id ? { ...s, doneAt: when } : s));
}

/** Minutes from `when` to the step that follows `id`, for showing "next step in ...". */
export function gapAfter(steps: Step[], id: string): number {
  const i = steps.findIndex((s) => s.id === id);
  const next = steps[i + 1];
  return i < 0 || !next ? 0 : (next.at - steps[i]!.at) / MIN;
}

/** "I already started, I am here": everything before `id` is done, the rest replans from `now`. */
export function resumeAt(steps: Step[], id: string, now: number): Step[] {
  const idx = steps.findIndex((s) => s.id === id);
  if (idx < 0) throw new RangeError(`unknown step ${id}`);
  const delta = (now - steps[idx]!.at) / MIN;
  return steps.map((s, i) =>
    i < idx ? { ...s, doneAt: s.doneAt ?? Math.min(s.at + delta * MIN, now) } : { ...s, at: s.at + delta * MIN },
  );
}

export type AlarmOp =
  | { op: 'set'; id: string; at: number; title: string; note?: string }
  | { op: 'cancel'; id: string };

const wantsAlarm = (s: Step): boolean => s.alarm && s.doneAt === undefined;

/**
 * What the phone's alarm clock must do to match `after`, given what it holds for `before`:
 * set new or moved alarms, cancel ones that were switched off, finished or removed.
 * Same input to the native layer on every change, so alarms never drift from the plan.
 */
export function alarmOps(before: Step[], after: Step[]): AlarmOp[] {
  const ops: AlarmOp[] = [];
  const prev = new Map(before.filter(wantsAlarm).map((s) => [s.id, s]));
  for (const s of after) {
    if (!wantsAlarm(s)) continue;
    const old = prev.get(s.id);
    if (!old || old.at !== s.at || old.title !== s.title || old.note !== s.note) {
      ops.push({ op: 'set', id: s.id, at: s.at, title: s.title, ...(s.note ? { note: s.note } : {}) });
    }
    prev.delete(s.id);
  }
  for (const id of prev.keys()) ops.push({ op: 'cancel', id });
  return ops;
}

/** Switch a step's alarm on or off. */
export function setAlarm(steps: Step[], id: string, on: boolean): Step[] {
  if (!steps.some((s) => s.id === id)) throw new RangeError(`unknown step ${id}`);
  return steps.map((s) => (s.id === id ? { ...s, alarm: on } : s));
}

/**
 * Re-time the end of the bulk (the divide step and everything after it) from what you measured.
 * Does nothing until the bulk has started, and ignores differences under 5 minutes.
 */
export function retimeBulk(
  steps: Step[],
  bulk: { startAt: number; refMin: number; startC: number },
  readings: Reading[],
  now: number,
): Step[] {
  const divide = steps.find((s) => s.kind === 'divide' && s.doneAt === undefined);
  if (!divide || now < bulk.startAt) return steps;
  const st = bulkState(readings, now, bulk);
  const newEnd = now + st.remainingMin * MIN;
  const deltaMin = (newEnd - divide.at) / MIN;
  return Math.abs(deltaMin) < 5 ? steps : shift(steps, divide.id, deltaMin, true);
}

const renumber = (steps: Step[]): Step[] => {
  const n = steps.filter((s) => s.kind === 'fold').length;
  let i = 0;
  return steps.map((s) => (s.kind === 'fold' ? { ...s, title: `קיפול ${++i} מתוך ${n}` } : s)).sort((a, b) => a.at - b.at);
};

/** One more kneading round after the last one, one gap later (or halfway to shaping if that is too late). */
export function addFold(steps: Step[], gapMin = 30): Step[] {
  const folds = steps.filter((s) => s.kind === 'fold');
  const last = folds[folds.length - 1];
  const divide = steps.find((s) => s.kind === 'divide');
  if (!last || !divide) return steps;
  const wanted = last.at + gapMin * MIN;
  const at = wanted < divide.at - 20 * MIN ? wanted : last.at + (divide.at - last.at) / 2;
  const id = `fold-${Math.max(...steps.map((s) => Number(s.id.replace(/\D/g, '')) || 0)) + 1}`;
  return renumber([...steps, { id, kind: 'fold', title: '', at, alarm: true, note: FOLD_WHY }]);
}

export function removeFold(steps: Step[], id: string): Step[] {
  const s = steps.find((x) => x.id === id);
  if (!s || s.kind !== 'fold') return steps;
  return renumber(steps.filter((x) => x.id !== id));
}
