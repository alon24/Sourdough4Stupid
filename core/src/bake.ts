/** Baking profile by loaf weight and shape. Base: 900 g free-form, 240° 25 min covered + 230° 20 min open. */

export type LoafShape = 'free' | 'tin';

export interface BakeProfile {
  coveredTemp: number;
  coveredMin: number;
  openTemp: number;
  openMin: number;
  totalMin: number;
  /** minutes out of the tin at the end, to crisp the sides (tin loaves only) */
  outOfTinMin: number;
  /** internal temperature that means "done" */
  doneCoreTemp: number;
}

export function bakeProfile(weight: number, shape: LoafShape = 'free'): BakeProfile {
  if (weight <= 0) throw new RangeError('weight must be positive');
  // every 150 g above 900 adds 5 min open; from 1100 g the covered phase is 5 min longer
  const extraOpen = 5 * Math.ceil(Math.max(0, weight - 900) / 150);
  const extraCovered = weight >= 1100 ? 5 : 0;
  const lighter = weight < 700 ? -5 : 0;
  const p =
    shape === 'tin'
      ? { coveredTemp: 230, coveredMin: 25 + extraCovered, openTemp: 210, openMin: 20 + extraOpen + lighter, outOfTinMin: 5 }
      : { coveredTemp: 240, coveredMin: 25 + extraCovered, openTemp: 230, openMin: 20 + extraOpen + lighter, outOfTinMin: 0 };
  return { ...p, totalMin: p.coveredMin + p.openMin, doneCoreTemp: shape === 'tin' ? 97 : 96 };
}

/** Dough weight that suits a tin of the given volume (litres): the dough should fill about 55%. */
export function doughForTin(litres: number): number {
  if (litres <= 0) throw new RangeError('volume must be positive');
  return Math.round((litres * 550) / 10) * 10;
}
