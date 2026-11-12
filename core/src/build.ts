/** Starter-first planning: how much dough a given amount of starter makes, and the feeding chain
 *  that turns the little you have (say 30 g from the fridge) into the amount you want (say 300 g). */
import { dough } from './dough.js';
import { feed, ratioForWindow, seedFor, type Ratio, type StarterType } from './starter.js';

export interface Stage {
  seed: number;
  ratio: Ratio;
  addFlour: number;
  addWater: number;
  /** grams after this feeding, which is the seed of the next stage */
  total: number;
  /** hours until it peaks */
  hours: number;
}

export interface ChainOptions {
  /** grams of starter you have now (e.g. in the fridge) */
  have: number;
  /** grams of starter you want, ready to use */
  target: number;
  type: StarterType;
  hydration: number;
  tempC?: number;
  speedFactor?: number;
  /** preferred hours per feeding */
  windowH?: number;
  margin?: number;
  keep?: number;
  /** one big overnight feeding (stiff 1:6:3, liquid 1:5:5, about 11 h) instead of several short ones, when `have` allows */
  overnight?: boolean;
}

export const MAX_STAGES = 4;

/** Fewest feedings that get from `have` to `target`; each one is sized so nothing is wasted. */
export function buildChain(o: ChainOptions): Stage[] {
  if (o.have <= 0 || o.target <= 0) throw new RangeError('have and target must be positive');
  if (o.overnight) {
    const keepG = o.keep ?? 30;
    const need = o.target + keepG;
    const seed = Math.min(o.have, need / 10);
    if (need / 10 <= o.have * 1.05 + 1e-9) {
      // flour and water make up the rest, split in the overnight ratio (stiff 2:1 flour:water = 50%)
      const stiff = o.type === 'stiff';
      const addFlour = (need - seed) * (stiff ? 2 / 3 : 0.5);
      const addWater = need - seed - addFlour;
      return [{ seed, ratio: { a: addFlour / seed, b: addWater / seed }, addFlour, addWater, total: need, hours: 11 }];
    }
  }
  const choice = ratioForWindow(o.windowH ?? 10, {
    type: o.type, hydration: o.hydration, tempC: o.tempC, speedFactor: o.speedFactor,
  });
  const { margin = 0.1, keep = 30 } = o;
  let n = 1;
  while (n < MAX_STAGES && seedFor(o.target, Array<Ratio>(n).fill(choice.ratio), { margin, keep }) > o.have) n++;

  let seed = seedFor(o.target, Array<Ratio>(n).fill(choice.ratio), { margin, keep });
  let h = o.hydration;
  const stages: Stage[] = [];
  for (let i = 0; i < n; i++) {
    const f = feed(seed, h, choice.ratio);
    stages.push({ seed, ratio: choice.ratio, addFlour: f.addFlour, addWater: f.addWater, total: f.total, hours: choice.hours });
    seed = f.total;
    h = f.hydration;
  }
  return stages;
}

export interface YieldConfig {
  loafWeight?: number;
  rollWeight?: number;
  hydration?: number;
  salt?: number;
  levainPct?: number;
  /** total inclusion share of flour, e.g. 0.18 */
  inclusionPct?: number;
  loss?: number;
}

export interface YieldOption {
  loaves: number;
  rolls: number;
  /** dough used, grams */
  used: number;
  /** dough left over, too small for another piece */
  left: number;
}

/** Dough weight that `starter` grams of levain can carry at the usual levain share of flour. */
export function doughFromStarter(starter: number, cfg: YieldConfig = {}): number {
  const { hydration = 0.72, salt = 0.02, levainPct = 0.2, inclusionPct = 0, loss = 0.02 } = cfg;
  if (starter <= 0) return 0;
  const flour = starter / levainPct;
  return (flour * (1 + hydration + salt + inclusionPct)) / (1 + loss);
}

/** All sensible loaf/roll splits for the dough that `starter` grams carry, most loaves first. */
export function yieldOptions(starter: number, cfg: YieldConfig = {}): YieldOption[] {
  const { loafWeight = 900, rollWeight = 90 } = cfg;
  const D = doughFromStarter(starter, cfg);
  const out: YieldOption[] = [];
  for (let loaves = Math.floor(D / loafWeight); loaves >= 0; loaves--) {
    const rolls = Math.floor((D - loaves * loafWeight) / rollWeight);
    if (loaves + rolls === 0) continue;
    const used = loaves * loafWeight + rolls * rollWeight;
    out.push({ loaves, rolls, used, left: D - used });
  }
  return out;
}

/** Check that a split really fits the starter, using the real dough formula. */
export function fits(starter: number, loaves: number, rolls: number, cfg: YieldConfig = {}): boolean {
  const { loafWeight = 900, rollWeight = 90, hydration = 0.72, salt = 0.02, levainPct = 0.2, loss = 0.02 } = cfg;
  const pieces = [
    ...(loaves > 0 ? [{ name: 'loaf', count: loaves, weight: loafWeight }] : []),
    ...(rolls > 0 ? [{ name: 'roll', count: rolls, weight: rollWeight }] : []),
  ];
  if (pieces.length === 0) return true;
  const inclusions = cfg.inclusionPct ? [{ name: 'inclusions', pct: cfg.inclusionPct }] : [];
  return dough({ pieces, hydration, salt, levainPct, levainHydration: 0.5, loss, inclusions }).levain <= starter + 1e-6;
}
