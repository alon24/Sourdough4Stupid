/** Standalone starter care: change hydration (stiff <-> liquid), grow to an amount, and time it to be ready at a chosen moment. */
import { feed, peakHours, ratioForWindow, revivalFeeds, seedFor, split, type Ratio, type StarterType } from './starter.js';

const HOUR = 3_600_000;
export const MAX_FEEDS = 5;

export interface FeedAmounts {
  seed: number;
  addFlour: number;
  addWater: number;
  total: number;
  /** hydration of the result (water / flour) */
  hydration: number;
}

/** One feeding of `seed` g (hydration `seedH`) that grows it `k` times and ends at hydration `toH`. Null when the target hydration is out of reach. */
export function feedTo(seed: number, seedH: number, k: number, toH: number): FeedAmounts | null {
  const { flour, water } = split(seed, seedH);
  const add = seed * (k - 1);
  const addFlour = (add - toH * flour + water) / (1 + toH);
  const addWater = add - addFlour;
  if (addFlour < -1e-9 || addWater < -1e-9) return null;
  const f = Math.max(0, addFlour);
  const w = Math.max(0, addWater);
  return { seed, addFlour: f, addWater: w, total: seed + f + w, hydration: (water + w) / (flour + f) };
}

export type StarterStepKind = 'revive' | 'feed' | 'ready';

export interface StarterStep {
  kind: StarterStepKind;
  /** when the feeding is done */
  at: number;
  /** hours until the starter peaks after this feeding (0 for the last "ready" step) */
  hours: number;
  title: string;
  note: string;
  amounts?: FeedAmounts;
}

export interface StarterGoal {
  /** grams on hand */
  have: number;
  fromType: StarterType;
  fromHydration: number;
  /** grams wanted, ready to use */
  target: number;
  toType: StarterType;
  toHydration: number;
  /** when it should be at its peak; omitted = as soon as possible */
  readyAt?: number;
  now: number;
  daysInFridge?: number;
  tempC?: number;
  speedFactor?: number;
  /** grams that go back to the fridge as the next seed */
  keep?: number;
  /** preferred hours per feeding */
  windowH?: number;
}

export interface StarterPlanResult {
  steps: StarterStep[];
  /** peak of the last feeding */
  readyAt: number;
  /** the requested time is too close: this is the earliest possible */
  late: boolean;
  /** seed to start with (may be less than what you have) */
  seed: number;
  /** more than MAX_FEEDS needed or the conversion is not reachable */
  problem?: 'tooMuch' | 'conversion';
}

const he = (n: number): string => `${Math.round(n)} ג'`;

/** Backward plan: the fewest feedings that turn `have` into `target`, converting hydration on the first one and ending at the peak at `readyAt`. */
export function starterPlan(g: StarterGoal): StarterPlanResult {
  const keep = g.keep ?? 30;
  const revive = g.daysInFridge === undefined ? 0 : revivalFeeds(g.daysInFridge);
  const choice = ratioForWindow(g.windowH ?? 10, { type: g.toType, hydration: g.toHydration, tempC: g.tempC, speedFactor: g.speedFactor });
  const ratio: Ratio = choice.ratio;
  const k = 1 + ratio.a + ratio.b;

  let n = Math.max(1, revive + 1);
  while (n < MAX_FEEDS && seedFor(g.target, Array<Ratio>(n).fill(ratio), { keep }) > g.have) n++;
  const needed = seedFor(g.target, Array<Ratio>(n).fill(ratio), { keep });
  const startSeed = Math.min(needed, g.have);
  const tooMuch = needed > g.have * 1.05 + 1e-9;

  // the stage sizes: forward from the seed, each stage grows k times (last one trimmed to exactly the need)
  const amounts: FeedAmounts[] = [];
  let seed = startSeed;
  let h = g.fromHydration;
  let problem: StarterPlanResult['problem'] = tooMuch ? 'tooMuch' : undefined;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const kk = last ? Math.max(1.0001, (g.target * 1.1 + keep) / seed) : k;
    const a = feedTo(seed, h, kk, g.toHydration);
    if (!a) { problem = 'conversion'; break; }
    amounts.push(a);
    seed = a.total;
    h = a.hydration;
  }
  const durations = amounts.map((a, i) => i === amounts.length - 1 && a.total < 1 ? 0 : peakHours({ type: g.toType, a: a.addFlour / a.seed, tempC: g.tempC, speedFactor: g.speedFactor }));
  const total = durations.reduce((x, y) => x + y, 0) * HOUR;
  let readyAt = g.readyAt ?? g.now + total;
  let late = false;
  if (readyAt - total < g.now) { readyAt = g.now + total; late = g.readyAt !== undefined; }
  let t = readyAt - total;
  const steps: StarterStep[] = amounts.map((a, i) => {
    const at = t;
    t += durations[i]! * HOUR;
    const reviving = i < revive;
    const conv = i === 0 && Math.abs(g.fromHydration - g.toHydration) > 0.05;
    const word = g.toType === 'stiff' ? 'קשה' : 'נוזלי';
    const title = reviving ? 'האכלת חיזוק' : conv ? `להאכיל וליצור סטארטר ${word}` : 'האכלת סטארטר';
    const note = `${he(a.seed)} סטארטר + ${he(a.addFlour)} קמח + ${he(a.addWater)} מים = ${he(a.total)}.${conv ? ` ההידרציה עוברת ל־${Math.round(a.hydration * 100)}%.` : ''} שיא בעוד כ־${Math.round(durations[i]!)} שעות.`;
    return { kind: reviving ? 'revive' : 'feed', at, hours: durations[i]!, title, note, amounts: a };
  });
  steps.push({ kind: 'ready', at: readyAt, hours: 0, title: 'הסטארטר בשיא: להשתמש בו', note: `${he(g.target)} לשימוש, ו־${he(keep)} חוזרים למקרר כגרעין.` });
  return { steps, readyAt, late, seed: startSeed, ...(problem ? { problem } : {}) };
}
