/** Flour catalog and hydration advice. Absorption = extra hydration (in points of flour weight)
 *  that a 100% share of this flour needs, compared with ordinary white bread flour. Starting values. */

export interface FlourInfo {
  id: string;
  name: string;
  absorption: number;
}

export const FLOURS: FlourInfo[] = [
  { id: 'white', name: 'לבן', absorption: 0 },
  { id: 'tipo0', name: 'טיפו 0', absorption: 0.02 },
  { id: 'whole', name: 'מלא', absorption: 0.25 },
  { id: 'spelt', name: 'כוסמין', absorption: -0.05 },
  { id: 'rye', name: 'שיפון', absorption: 0.2 },
];

export interface BlendShare {
  id: string;
  /** fraction of total flour */
  pct: number;
}

let custom: FlourInfo[] = [];
/** The user's own flours (replaces the previous custom list). */
export const registerFlours = (list: FlourInfo[]): void => {
  custom = list;
};
export const allFlours = (): FlourInfo[] => [...FLOURS, ...custom];

const find = (id: string): FlourInfo => {
  const f = allFlours().find((x) => x.id === id);
  if (!f) throw new RangeError(`unknown flour ${id}`);
  return f;
};

export const flourName = (id: string): string => find(id).name;

/** Hydration that feels comfortable for this blend, rounded to a whole percent. */
export function suggestHydration(blend: BlendShare[], base = 0.7): number {
  const total = blend.reduce((s, b) => s + b.pct, 0);
  if (Math.abs(total - 1) > 1e-6) throw new RangeError('flour shares must sum to 100%');
  const raw = base + blend.reduce((s, b) => s + b.pct * find(b.id).absorption, 0);
  return Math.round(raw * 100) / 100;
}

export type HydrationLevel = 'ok' | 'low' | 'high';

export interface HydrationAdvice {
  suggested: number;
  /** chosen minus suggested, in points (0.04 = 4 points) */
  diff: number;
  level: HydrationLevel;
}

/** Compare the hydration you picked with what suits the blend. Within 2 points is fine. */
export function hydrationAdvice(blend: BlendShare[], chosen: number, base = 0.7): HydrationAdvice {
  const suggested = suggestHydration(blend, base);
  const diff = Math.round((chosen - suggested) * 100) / 100;
  return { suggested, diff, level: diff > 0.02 ? 'high' : diff < -0.02 ? 'low' : 'ok' };
}
