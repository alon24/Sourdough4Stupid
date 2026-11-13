import { allFlours, starterNeed } from '../../core/src/index';
import { shortDate } from './format';
import { STATUS_LABEL } from './screens/Log';
import type { ActivePlan, HistoryEntry, Recipe } from './store';

const flourLine = (mix: { flour: string; grams: number }[]): string => {
  const total = mix.reduce((s, m) => s + m.grams, 0) || 1;
  return mix.map((m) => `${allFlours().find((f) => f.id === m.flour)?.name ?? m.flour} ${Math.round((m.grams / total) * 100)}%`).join(' + ');
};

const methodLine = (kneading: 'hand' | 'machine', autolyse: boolean | undefined, cold: boolean): string =>
  [kneading === 'machine' ? 'מכונה' : 'ידנית', autolyse === false ? 'בלי אוטוליזה' : 'עם אוטוליזה', cold ? 'לילה במקרר' : 'אותו יום'].join(' · ');

/** a recipe in three short lines: what it is, how it is made, how it went so far */
export function recipeSummary(r: Recipe, history: HistoryEntry[]): string[] {
  const items = r.items ?? [];
  const starter = items.length ? Math.round(starterNeed(items).grams) : 0;
  const mine = history.filter((h) => h.recipeId === r.id);
  const last = mine[0];
  return [
    [flourLine(r.mix), `הידרציה ${Math.round(r.hydration * 100)}%`, starter > 0 ? `סטארטר ${starter} ג'` : ''].filter(Boolean).join(' · '),
    methodLine(r.kneading, r.autolyse, r.cold),
    last ? `נאפה ${mine.length === 1 ? 'פעם אחת' : `${mine.length} פעמים`} · לאחרונה ${shortDate(last.finishedAt)} · ${STATUS_LABEL[last.status ?? 'finished']}` : 'עוד לא נאפה',
  ];
}

/** a running bake in one line: hydration, starter, how it is kneaded */
export function planSummary(p: ActivePlan): string {
  const levain = p.amounts.find((a) => a.name === 'מחמצת');
  const h = p.input?.hydration;
  return [
    h !== undefined ? `הידרציה ${Math.round(h * 100)}%` : '',
    levain ? `מחמצת ${Math.round(levain.grams)} ג'` : '',
    p.kneading ? (p.kneading === 'machine' ? 'מכונה' : 'ידנית') : '',
    p.input ? (p.input.coldProof ? 'לילה במקרר' : 'אותו יום') : '',
  ].filter(Boolean).join(' · ');
}
