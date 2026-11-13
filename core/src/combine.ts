/**
 * Scaling and combining. A recipe is stored once, for a base batch (say 1 loaf + 6 rolls).
 * At plan time the baker picks a multiplier per recipe, and several recipes can share one dough
 * when their doughs are compatible. Not everything can be combined: the check says what, and why.
 */
import { DEFAULT_ITEM_TYPES, type Item } from './items.js';

/** What makes a dough different from the plain bread dough, as shares of the flour. */
export interface DoughProfile {
  /** fat added into the dough (olive oil), share of flour */
  fat: number;
  /** sugar or honey, share of flour */
  sugar: number;
  /** salt, share of flour */
  salt: number;
}

export const PLAIN: DoughProfile = { fat: 0, sugar: 0, salt: 0.02 };

/** Typical doughs per item type. Pizza usually takes olive oil, bagels a little sweetener and less water. */
export const PROFILES: Record<string, DoughProfile> = {
  loaf: PLAIN,
  pan: PLAIN,
  rolls: PLAIN,
  pizza: { fat: 0.03, sugar: 0, salt: 0.022 },
  bagel: { fat: 0, sugar: 0.03, salt: 0.02 },
  custom: PLAIN,
};

const nameOf = (i: Item): string => i.name ?? DEFAULT_ITEM_TYPES.find((t) => t.id === i.type)?.name ?? 'פריט';

export const scaleItems = (items: Item[], k: number): Item[] => items.map((i) => ({ ...i, count: Math.round(i.count * k * 100) / 100 }));

/** Sum items of the same type and weight, so 2 + 1 loaves become 3. */
export function mergeItems(lists: Item[][]): Item[] {
  const out: Item[] = [];
  for (const i of lists.flat()) {
    const same = out.find((o) => o.type === i.type && o.weight === i.weight && o.name === i.name && o.starterPct === i.starterPct);
    if (same) same.count += i.count;
    else out.push({ ...i });
  }
  return out;
}

export interface Part {
  label: string;
  items: Item[];
  /** water as a share of flour: 0.72 */
  hydration: number;
}

export interface CombineResult {
  /** parts that can share the first part's dough */
  together: Part[];
  /** parts that cannot, with the reason in plain Hebrew */
  separate: { part: Part; why: string }[];
  /** item-specific additions to make at the split, for the parts that stay together */
  notes: string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const profileOf = (i: Item): DoughProfile => PROFILES[i.type] ?? PLAIN;

/**
 * The first part is the dough everything else tries to join.
 * Different hydration (more than 5 points) or sugar (more than 2 points) cannot be fixed at the split: separate doughs.
 * Extra fat (olive oil for pizza) can: it goes only into that portion, with the grams stated.
 */
export function combineCheck(parts: Part[]): CombineResult {
  const [base, ...rest] = parts;
  if (!base) return { together: [], separate: [], notes: [] };
  const baseSugar = Math.max(0, ...base.items.map((i) => profileOf(i).sugar));
  const baseFat = Math.max(0, ...base.items.map((i) => profileOf(i).fat));
  const together: Part[] = [base];
  const separate: CombineResult['separate'] = [];
  const notes: string[] = [];
  const consider = (p: Part, inBase: boolean) => {
    const why: string[] = [];
    if (Math.abs(p.hydration - base.hydration) > 0.05) why.push(`ההידרציה שונה (${pct(p.hydration)} מול ${pct(base.hydration)})`);
    const sugar = Math.max(0, ...p.items.map((i) => profileOf(i).sugar));
    if (Math.abs(sugar - baseSugar) > 0.02) why.push('יש בו הרבה יותר או פחות סוכר או דבש');
    if (why.length > 0) return void separate.push({ part: p, why: `${p.label}: ${why.join(' ו')}. בצק כזה לא מתחלק מבצק הבסיס, לכן אופים אותו בנפרד.` });
    if (!inBase) together.push(p);
    for (const i of p.items) {
      const extra = profileOf(i).fat - baseFat;
      if (extra > 0.005) {
        const flour = (i.count * i.weight) / (1 + p.hydration + extra + 0.02);
        notes.push(`${nameOf(i)}: להוסיף כ־${Math.round(flour * extra)} ג' שמן זית רק לחלק הזה, בשלב החלוקה (לא לבצק כולו).`);
      }
    }
  };
  consider(base, true);
  rest.forEach((p) => consider(p, false));
  return { together, separate, notes };
}
