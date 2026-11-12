import type { Plan, PlanInput } from '../../core/src/index';
import type { ActivePlan } from './store';

/** Turn an engine plan into what the app stores and shows. */
export function toActive(p: Plan, input: PlanInput, title: string, now = Date.now()): ActivePlan {
  const d = p.dough;
  return {
    title,
    createdAt: now,
    steps: p.steps,
    input,
    build:
      p.chain.length === 0
        ? 'הסטארטר כבר מוכן'
        : p.chain
            .map((c, i) => `${p.chain.length > 1 ? `${i + 1}. ` : ''}${Math.round(c.seed)} ג' סטארטר + ${Math.round(c.addFlour)} ג' קמח + ${Math.round(c.addWater)} ג' מים`)
            .join(' · '),
    kneading: input.kneading,
    bulk: p.bulk,
    readings: [],
    amounts: [
      { name: 'קמח', grams: d.addFlour },
      { name: 'מים', grams: d.addWater },
      { name: 'מחמצת', grams: d.levain },
      { name: 'מלח', grams: d.salt },
      ...d.inclusions,
    ],
  };
}
