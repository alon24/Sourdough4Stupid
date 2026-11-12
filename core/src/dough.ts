/** Dough formula in baker's percentages. All percentages are fractions of TOTAL flour, */
/** which includes the flour inside the levain, so true hydration does not depend on starter type. */
import { split } from './starter.js';

export interface Piece {
  name: string;
  count: number;
  /** dough weight per piece, grams */
  weight: number;
}

export interface Inclusion {
  name: string;
  /** fraction of total flour, e.g. 0.2 */
  pct: number;
}

export interface FlourShare {
  name: string;
  /** fraction of total flour; shares must sum to 1 */
  pct: number;
}

export interface DoughSpec {
  pieces: Piece[];
  hydration: number;
  salt: number;
  /** levain mass as a fraction of total flour */
  levainPct: number;
  levainHydration: number;
  /** other additions as fraction of total flour (oil, sugar, butter...) */
  extras?: Inclusion[];
  inclusions?: Inclusion[];
  flours?: FlourShare[];
  /** dough lost on hands and bowl, e.g. 0.02 */
  loss?: number;
}

export interface DoughResult {
  totalDough: number;
  totalFlour: number;
  totalWater: number;
  levain: number;
  addFlour: number;
  addWater: number;
  salt: number;
  flours: { name: string; grams: number }[];
  extras: { name: string; grams: number }[];
  inclusions: { name: string; grams: number }[];
  split: { name: string; count: number; weight: number; total: number }[];
}

export function dough(spec: DoughSpec): DoughResult {
  const { pieces, hydration, salt, levainPct, levainHydration, loss = 0.02 } = spec;
  const extras = spec.extras ?? [];
  const inclusions = spec.inclusions ?? [];
  const flours = spec.flours ?? [{ name: 'white', pct: 1 }];

  const wanted = pieces.reduce((sum, p) => sum + p.count * p.weight, 0);
  if (wanted <= 0) throw new RangeError('nothing to bake');
  const flourSum = flours.reduce((s, f) => s + f.pct, 0);
  if (Math.abs(flourSum - 1) > 1e-6) throw new RangeError('flour shares must sum to 100%');

  const totalDough = wanted * (1 + loss);
  const sumPct = (xs: Inclusion[]) => xs.reduce((s, x) => s + x.pct, 0);
  const totalFlour = totalDough / (1 + hydration + salt + sumPct(extras) + sumPct(inclusions));
  const totalWater = totalFlour * hydration;
  const levain = totalFlour * levainPct;
  const inLevain = split(levain, levainHydration);
  if (inLevain.water > totalWater) throw new RangeError('levain holds more water than the dough allows');

  const addFlour = totalFlour - inLevain.flour;
  return {
    totalDough,
    totalFlour,
    totalWater,
    levain,
    addFlour,
    addWater: totalWater - inLevain.water,
    salt: totalFlour * salt,
    // the levain's flour is taken out of the blend proportionally
    flours: flours.map((f) => ({ name: f.name, grams: addFlour * f.pct })),
    extras: extras.map((x) => ({ name: x.name, grams: totalFlour * x.pct })),
    inclusions: inclusions.map((x) => ({ name: x.name, grams: totalFlour * x.pct })),
    split: pieces.map((p) => ({ ...p, total: p.count * p.weight })),
  };
}

/** Water temperature needed to hit the desired dough temperature. */
export function waterTemp(opts: {
  desired?: number;
  flour: number;
  room: number;
  levain: number;
  friction: number;
}): number {
  const { desired = 25, flour, room, levain, friction } = opts;
  return desired * 4 - flour - room - levain - friction;
}

export const FRICTION = { hand: 1, machine: 12 } as const;

export const PRESETS = {
  bread: { hydration: 0.72, salt: 0.02, levainPct: 0.2, pieceWeight: 900 },
  crustyRoll: { hydration: 0.72, salt: 0.02, levainPct: 0.2, pieceWeight: 90 },
  pizza: {
    hydration: 0.65,
    salt: 0.025,
    levainPct: 0.18,
    pieceWeight: 260,
    extras: [{ name: 'olive oil', pct: 0.02 }],
  },
} as const;
