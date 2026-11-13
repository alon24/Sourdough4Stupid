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
  | 'revive' | 'feed' | 'soak' | 'autolyse' | 'mix' | 'fold' | 'divide' | 'enrich' | 'shapeRolls'
  | 'shape' | 'outOfTin' | 'fridge' | 'preheat' | 'bake' | 'uncover' | 'done' | 'bakeRolls' | 'rollsDone' | 'custom';

export interface Step {
  id: string;
  kind: StepKind;
  title: string;
  /** epoch milliseconds */
  at: number;
  alarm: boolean;
  note?: string;
  doneAt?: number;
  /** after the split: the branch (one loaf, or the rolls) this step belongs to */
  track?: string;
  /** the baker's own note on this step */
  userNote?: string;
  /** kneading round or mix: by hand or machine (can change during the bake) */
  method?: 'hand' | 'machine';
}

export const ROLL_BAKE = 'תנור 230° עם תבנית מים רותחים בתחתית. חריץ קטן בראש כל לחמנייה, אפשר להבריש מים ולפזר שומשום, פרג או שיבולת שועל. 12 דק\' עם אדים, להוציא את תבנית המים, להנמיך ל־210° ועוד 8–10 דק\' עד השחמה עמוקה. מהמקרר ישר לתנור.';

export const MIX_AUTOLYSE = { title: 'להוסיף מחמצת ומלח', note: 'מערבבים את הסטארטר, ואחריו המלח עם קצת מהמים שנשארו.' };
export const MIX_ALLIN = {
  title: 'לערבב הכול יחד ולמוך',
  note: "מפוררים את הסטארטר במים, מוסיפים קמח ומלח, ולשים 6–8 דק' עד בצק חלק ואלסטי שנפרד מהדפנות. אחר כך 30 דק' מנוחה לפני הקיפול הראשון.",
};
export const AUTOLYSE = { title: 'אוטוליזה: קמח ומים', note: "לערבב את הקמח עם רוב המים ולהשאיר לנוח. הקמח הלבן צריך פחות זמן (30–40 דק')." };

export const BULK_DONE = 'הבצק גדל ב־50%–60%: כיפה מעוגלת, רועד כשמטלטלים את הקערה, ובועות בצדדים ובתחתית.';

export interface Split {
  loaves: number;
  loafWeight: number;
  rolls: number;
  /** grams per roll */
  rollWeight: number;
  /** dough that goes to the rolls */
  rollDough: number;
  total: number;
}

/** What to cut at the end of the bulk. */
export function splitOf(total: number, loaves: number, loafWeight: number, rolls: number): Split {
  const rollDough = Math.max(0, total - loaves * loafWeight);
  return { loaves, loafWeight, rolls, rollWeight: rolls > 0 ? rollDough / rolls : 0, rollDough, total };
}

export const splitText = (sp: Split, rollsName = 'לחמניות'): string =>
  [
    sp.loaves > 0 && `${sp.loaves} כיכרות × ${Math.round(sp.loafWeight)} ג'`,
    sp.rolls > 0 && `${sp.rolls} ${rollsName} × ${Math.round(sp.rollWeight)} ג' (${Math.round(sp.rollDough)} ג' בסך הכול)`,
  ].filter(Boolean).join(' + ');

export const ENRICH_PCT = 0.055;
export const FOLD_WHY = 'קיפולים מחזקים את הגלוטן בלי לישה ארוכה. ברירת המחדל 4; אפשר להוסיף או להוריד לפי מגע הבצק.';

export interface PlanInput {
  /** what the non-loaf pieces are called (default לחמניות), and how to bake them */
  rollsName?: string;
  rollsBake?: string;
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
  /** size the dough so that all of `buildTarget` (the starter you build) goes into it */
  useAllStarter?: boolean;
  /** autolyse before mixing (default true); false means everything goes in together */
  autolyse?: boolean;
  /** one big overnight feeding instead of several short ones */
  overnightFeed?: boolean;
  /** enrich only the rolls after the split */
  rollEnrich?: 'oil' | 'silan';
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
    feedWindowH = 10, hydration = 0.72, salt = 0.02,
  } = input;
  let levainPct = input.levainPct ?? 0.2;
  const inclusions = input.inclusions ?? [];
  if (loaves < 0 || rolls < 0 || loaves + rolls === 0) throw new RangeError('nothing to bake');

  const pieces: Piece[] = [];
  if (loaves > 0) pieces.push({ name: 'loaf', count: loaves, weight: loafWeight });
  if (rolls > 0) pieces.push({ name: 'roll', count: rolls, weight: rollWeight });
  const flours = (input.blend ?? [{ id: 'white', pct: 1 }]).map((b) => ({ name: flourName(b.id), pct: b.pct }));
  let d = dough({ pieces, hydration, salt, levainPct, levainHydration: starter.hydration, inclusions, flours });
  if (input.useAllStarter && input.buildTarget && input.levainPct === undefined) {
    levainPct = Math.min(0.3, Math.max(0.1, input.buildTarget / d.totalFlour));
    d = dough({ pieces, hydration, salt, levainPct, levainHydration: starter.hydration, inclusions, flours });
  }

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
      add('bakeRolls', 'לאפות לחמניות: 230° עם אדים', outOfOvenAt + 5 * MIN, true, ROLL_BAKE);
      add('rollsDone', 'להוציא את הלחמניות', outOfOvenAt + 25 * MIN);
    }
  } else {
    add('rollsDone', 'להוציא את הלחמניות', outOfOvenAt);
    add('bakeRolls', 'לאפות לחמניות: 230° עם אדים', bakeStart, true, ROLL_BAKE);
  }
  add('preheat', `לחמם תנור ל־${hasLoaves ? bp.coveredTemp : 230}°`, bakeStart - (tin ? 30 : 60) * MIN);

  const tf = tempFactor(roomTempC);
  const finalProofMs = coldProof ? 12 * HOUR : 1.5 * HOUR * tf;
  const shapeAt = bakeStart - finalProofMs;
  add('shape', tin ? (coldProof ? 'לעצב לגליל, לתבנית משומנת ולמקרר' : 'לעצב לגליל ולתבנית משומנת') : (coldProof ? 'לעצב ולמקרר' : 'לעצב'), shapeAt, true,
    tin ? 'התפחה עד שהבצק מגיע לשפת התבנית. אין צורך בחריצה' : undefined);
  const divideAt = shapeAt - 30 * MIN;
  const split = splitOf(d.totalDough, loaves, loafWeight, rolls);
  const loafHow = 'כיכרות: עיצוב מוקדם, מנוחה 15–20 דק\', עיצוב סופי לסלסילות, ' + (coldProof ? 'ישר למקרר ללילה.' : 'ולהתפיח.');
  const rollHow = 'לחמניות: כדורים מתוחים על משטח בלי קמח (כדי שיהיה אחיזה), 5–7 ס"מ ביניהן על נייר אפייה, ' +
    (coldProof ? 'לכסות היטב: למקרר ללילה ולאפות קר, או להתפיח בחוץ 1.5–2 שעות ולאפות היום.' : 'לכסות ולהתפיח 1.5–2 שעות.');
  add('divide', rolls > 0 && hasLoaves ? 'לחלק: כיכרות ולחמניות' : 'עיצוב מוקדם', divideAt, true,
    [BULK_DONE, rolls > 0 && hasLoaves ? `לחלק: ${splitText(split)}` : undefined, hasLoaves ? loafHow : undefined, rolls > 0 ? 'לחמניות: ההוראות המלאות בשלב "לעצב לחמניות" כמה דקות אחרי.' : undefined]
      .filter(Boolean).join('\n'));
  if (rolls > 0) {
    add('shapeRolls', `לעצב ${rolls} לחמניות (${Math.round(split.rollWeight)} ג' כל אחת)`, divideAt + 20 * MIN, true,
      `לחתוך ${rolls} חתיכות של כ־${Math.round(split.rollWeight)} ג'.\n${rollHow}`);
  }
  if (rolls > 0 && input.rollEnrich) {
    const g = Math.round(split.rollDough * ENRICH_PCT);
    const what = input.rollEnrich === 'oil' ? `${g} ג' שמן זית` : `${g} ג' סילאן`;
    add('enrich', 'להעשיר את הלחמניות', divideAt + 5 * MIN, true,
      `רק לחלק של הלחמניות (${Math.round(split.rollDough)} ג'): ${what}, בלמינציה וקיפול 2–3 דק', מנוחה 15 דק', ואז לחלק ולעצב. הכיכרות נשארות רזות.`);
  }

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
  const useAutolyse = input.autolyse !== false;
  add('mix', useAutolyse ? MIX_AUTOLYSE.title : MIX_ALLIN.title, mixAt, true, useAutolyse ? MIX_AUTOLYSE.note : MIX_ALLIN.note);
  if (useAutolyse) {
    add('autolyse', AUTOLYSE.title, mixAt - (kneading === 'hand' ? 45 : 30) * MIN, true, AUTOLYSE.note);
  }
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
        tempC: roomTempC, speedFactor: starter.speedFactor, windowH: feedWindowH, overnight: input.overnightFeed,
      });
  const revive = revivalFeeds(starter.daysInFridge);
  let feedAt = mixAt;
  chain.forEach((st, i) => {
    const fromEnd = chain.length - 1 - i;
    const at = mixAt - chain.slice(i).reduce((sum, x) => sum + x.hours, 0) * HOUR;
    if (i === 0) feedAt = at;
    const r = st.ratio;
    const label = chain.length > 1 ? `האכלה ${i + 1} מתוך ${chain.length}` : 'להאכיל סטארטר';
    add('feed', `${label} 1:${+r.a.toFixed(1)}:${+r.b.toFixed(1)}`, at, true,
      `${Math.round(st.seed)} ג' סטארטר + ${Math.round(st.addFlour)} ג' קמח + ${Math.round(st.addWater)} ג' מים` +
        (fromEnd === 0 ? ` (יוצא ${Math.round(st.total)} ג')` : '') +
        (input.overnightFeed && chain.length === 1
          ? `. לפרק את הסטארטר במים פושרים, להוסיף קמח וללוש 3–4 דק' לכדור קשה וחלק, לגלגל למתח ולחרוץ X עמוק, בצנצנת סגורה בחדר (20–22°) כ־10–12 שעות. בבוקר החריץ נפתח כפרח והנפח יותר מכפול. לשמור 30 ג' בצד במקרר כגרעין לפעם הבאה, לפני שמערבבים את השאר לבצק.`
          : ''));
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
  for (const st of steps) if (st.kind === 'fold' || st.kind === 'mix') st.method = kneading;
  const rn = input.rollsName;
  if (rn && rn !== 'לחמניות') {
    for (const st of steps) {
      if (['divide', 'shapeRolls', 'enrich', 'bakeRolls', 'rollsDone'].includes(st.kind)) {
        st.title = st.title.replaceAll('לחמניות', rn);
        if (st.note) st.note = st.note.replaceAll('לחמניות', rn);
      }
      if (st.kind === 'bakeRolls' && input.rollsBake) { st.title = `לאפות ${rn}`; st.note = input.rollsBake; }
    }
  }
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

/**
 * Turn autolyse on or off in a running plan, from the step you are at.
 * Off: the autolyse step goes and the mix becomes "everything together, knead 6-8 min, rest 30".
 * On: an autolyse step is added before the mix; if there is no room before the mix it starts now
 * and the mix and everything after it move later by the missing time.
 * Does nothing once the mix is done.
 */
export function setAutolyse(steps: Step[], on: boolean, now: number, minutes = 45): Step[] {
  const mix = steps.find((s) => s.kind === 'mix');
  if (!mix || mix.doneAt !== undefined) return steps;
  const auto = steps.find((s) => s.kind === 'autolyse');
  if (on === (auto !== undefined)) return steps;
  const retitle = (list: Step[], t: { title: string; note: string }) =>
    list.map((s) => (s.id === mix.id ? { ...s, title: t.title, note: t.note } : s));
  if (!on) {
    if (auto!.doneAt !== undefined) return steps;
    return retitle(steps.filter((s) => s.id !== auto!.id), MIX_ALLIN);
  }
  const len = minutes * MIN;
  const id = `autolyse-${Math.max(...steps.map((s) => Number(s.id.replace(/\D/g, '')) || 0)) + 1}`;
  const at = Math.max(now, mix.at - len);
  const added: Step = { id, kind: 'autolyse', title: AUTOLYSE.title, at, alarm: true, note: AUTOLYSE.note };
  const withIt = retitle([...steps, added], MIX_AUTOLYSE);
  const delayMin = (at + len - mix.at) / MIN;
  const shifted = delayMin > 0.5 ? shift(withIt, mix.id, delayMin, true) : withIt;
  return shifted.sort((a, b) => a.at - b.at);
}
