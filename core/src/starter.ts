/** Starter math: hydration split, feeding, seed sizing, time to peak. */

export type StarterType = 'liquid' | 'stiff';

export interface Ratio {
  /** flour parts per 1 part starter */
  a: number;
  /** water parts per 1 part starter */
  b: number;
}

export interface FlourWater {
  flour: number;
  water: number;
}

/** Split a starter of mass `mass` at hydration `h` (water / flour) into flour and water. */
export function split(mass: number, h: number): FlourWater {
  if (mass < 0 || h < 0) throw new RangeError('mass and hydration must be non-negative');
  const flour = mass / (1 + h);
  return { flour, water: mass - flour };
}

export interface FeedResult {
  addFlour: number;
  addWater: number;
  total: number;
  /** resulting hydration of the whole starter */
  hydration: number;
}

/** Feed `seed` grams of starter (hydration `seedH`) at ratio 1:a:b. */
export function feed(seed: number, seedH: number, ratio: Ratio): FeedResult {
  if (seed <= 0) throw new RangeError('seed must be positive');
  const { flour, water } = split(seed, seedH);
  const addFlour = seed * ratio.a;
  const addWater = seed * ratio.b;
  return {
    addFlour,
    addWater,
    total: seed + addFlour + addWater,
    hydration: (water + addWater) / (flour + addFlour),
  };
}

export const growthFactor = (r: Ratio): number => 1 + r.a + r.b;

export interface SeedOptions {
  /** extra made to cover what sticks to the jar, e.g. 0.1 */
  margin?: number;
  /** grams kept back for the fridge */
  keep?: number;
}

/** Seed needed so that after the given feedings (in order) there are `target` grams to use. */
export function seedFor(target: number, ratios: Ratio[], opts: SeedOptions = {}): number {
  if (target <= 0) throw new RangeError('target must be positive');
  if (ratios.length === 0) throw new RangeError('at least one feeding is required');
  const { margin = 0.1, keep = 30 } = opts;
  const k = ratios.reduce((acc, r) => acc * growthFactor(r), 1);
  return (target * (1 + margin) + keep) / k;
}

/** Hours to peak at 24°C by flour ratio `a`. Starting points, tuned later by feedback. */
const PEAK_TABLE: Record<StarterType, [number, number][]> = {
  liquid: [[1, 4.5], [2, 6.5], [3, 8], [5, 11], [10, 15]],
  stiff: [[1, 5.5], [2, 9], [3, 11], [5, 13]],
};

function interpolate(table: [number, number][], x: number): number {
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!;
    const [x0, y0] = table[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** Time multiplier for temperature: every 8°C colder roughly doubles the time. */
export const tempFactor = (tempC: number): number => 2 ** ((24 - tempC) / 8);

export interface PeakOptions {
  type: StarterType;
  /** flour parts per 1 part starter */
  a: number;
  tempC?: number;
  /** learned per-starter multiplier, 1 = table speed */
  speedFactor?: number;
}

export function peakHours({ type, a, tempC = 24, speedFactor = 1 }: PeakOptions): number {
  if (a <= 0) throw new RangeError('ratio must be positive');
  return interpolate(PEAK_TABLE[type], a) * tempFactor(tempC) * speedFactor;
}

const CANDIDATES: Record<StarterType, number[]> = {
  liquid: [1, 2, 3, 4, 5, 6, 8, 10],
  stiff: [1, 2, 3, 4, 5],
};

export interface RatioChoice {
  ratio: Ratio;
  hours: number;
  /** true when even the slowest ratio peaks well before the window ends */
  windowTooLong: boolean;
}

/**
 * Pick the feeding ratio whose peak lands closest to `windowHours` without
 * overshooting it. Water follows the starter's own hydration.
 */
export function ratioForWindow(
  windowHours: number,
  opts: { type: StarterType; hydration: number; tempC?: number; speedFactor?: number },
): RatioChoice {
  const options = CANDIDATES[opts.type].map((a) => ({
    a,
    hours: peakHours({ type: opts.type, a, tempC: opts.tempC, speedFactor: opts.speedFactor }),
  }));
  const fitting = options.filter((o) => o.hours <= windowHours);
  const best = fitting.length > 0 ? fitting[fitting.length - 1]! : options[0]!;
  return {
    ratio: { a: best.a, b: best.a * opts.hydration },
    hours: best.hours,
    windowTooLong: windowHours - best.hours > 2,
  };
}

/** How many strengthening feedings a starter needs before the build, by days in the fridge. */
export function revivalFeeds(daysInFridge: number, weakAfterDays = 14): number {
  if (daysInFridge <= weakAfterDays) return 0;
  return daysInFridge <= 30 ? 1 : 2;
}
