/** What can be baked from one dough, and how much starter each kind usually needs. */

export interface ItemType {
  id: string;
  name: string;
  /** loaves bake covered in the pot or tin, everything else goes on the rolls track */
  group: 'loaf' | 'rolls';
  /** grams of dough per piece */
  weight: number;
  /** starter as a share of the dough weight (0.10 = 100 g per kg of dough) */
  starterPct: number;
  /** what to say at the bake step (rolls group) */
  bakeNote?: string;
  /** plural name for titles: "לחמניות", "פיצות" */
  plural: string;
}

/**
 * Typical starter use, as a share of the final dough weight. Sourdough breads use about 10-20% of
 * the flour weight as levain, which is 6-12% of the dough; a quick same-day rise wants more and a
 * long cold proof or pizza can do with less. The rule of thumb here is about 100 g of starter per
 * kg of dough. All numbers are editable defaults, not laws.
 */
export const DEFAULT_ITEM_TYPES: ItemType[] = [
  { id: 'loaf', name: 'לחם כפרי', plural: 'כיכרות', group: 'loaf', weight: 1000, starterPct: 0.1 },
  { id: 'pan', name: 'לחם פרוס בתבנית', plural: 'לחמי תבנית', group: 'loaf', weight: 900, starterPct: 0.12 },
  { id: 'rolls', name: 'לחמניות', plural: 'לחמניות', group: 'rolls', weight: 90, starterPct: 0.12 },
  { id: 'pizza', name: 'פיצה', plural: 'פיצות', group: 'rolls', weight: 250, starterPct: 0.06,
    bakeNote: 'תנור חם ככל האפשר (250–280°) עם אבן או תבנית הפוכה שחוממה היטב, 6–8 דק\' לפיצה. מהמקרר אפשר ישר לעבוד.' },
  { id: 'bagel', name: 'בייגלה', plural: 'בייגלה', group: 'rolls', weight: 110, starterPct: 0.1,
    bakeNote: 'לבשל 30 שניות מכל צד במים עם דבש או סוכר, ואז לאפות ב־220° כ־20 דק\' עד השחמה.' },
  { id: 'custom', name: 'פריט משלי', plural: 'יחידות', group: 'rolls', weight: 150, starterPct: 0.1 },
];

export interface Item {
  /** the item type id */
  type: string;
  count: number;
  weight: number;
  /** shown name, for custom items */
  name?: string;
  starterPct: number;
}

export const itemFrom = (t: ItemType, count = 1): Item => ({ type: t.id, count, weight: t.weight, starterPct: t.starterPct, name: t.name });

/** Dough weight and starter needed by all items. */
export function starterNeed(items: Item[]): { dough: number; grams: number } {
  const dough = items.reduce((s, i) => s + i.count * i.weight, 0);
  const grams = items.reduce((s, i) => s + i.count * i.weight * i.starterPct, 0);
  return { dough, grams };
}

/** A faster or slower rise from more or less starter (matches the plan: bulk ~ 1/sqrt(starter)). */
export const speedPct = (grams: number, needGrams: number): number =>
  needGrams > 0 ? Math.round((Math.sqrt(grams / needGrams) - 1) * 100) : 0;

export interface StarterOption { grams: number; leftover: number; speedPct: number; label: string }

export interface StarterCheck {
  status: 'none' | 'short' | 'ok' | 'lots';
  /** what the items normally need, rounded to 5 g */
  need: number;
  shortBy: number;
  options: StarterOption[];
}

const round5 = (x: number) => Math.round(x / 5) * 5;

/**
 * Compare the starter on hand with what the items need.
 * - short: less than 90% of the need on hand (build it up, or bake less)
 * - lots: more than 1.5 times the need: offer the normal amount and a stronger one, with what is left over
 * - ok: in between
 */
export function starterCheck(items: Item[], have: number): StarterCheck {
  const need = round5(starterNeed(items).grams);
  if (need <= 0) return { status: 'none', need: 0, shortBy: 0, options: [] };
  const opt = (grams: number, label: string): StarterOption => ({ grams, leftover: Math.max(0, Math.round(have - grams)), speedPct: speedPct(grams, need), label });
  if (have < need * 0.9) return { status: 'short', need, shortBy: Math.round(need - have), options: [opt(need, 'לבנות עד הכמות הרגילה')] };
  if (have > need * 1.5) {
    return { status: 'lots', need, shortBy: 0, options: [opt(need, 'הכמות הרגילה'), opt(round5(need * 1.5), 'יותר, התפחה מהירה יותר')].filter((o) => o.grams <= have) };
  }
  return { status: 'ok', need, shortBy: 0, options: [opt(need, 'הכמות הרגילה')] };
}
