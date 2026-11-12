import { splitOf, type PlanInput, type Step } from './plan.js';
import { tempFactor } from './starter.js';

const MIN = 60_000;
/** where a branch (a loaf or the rolls) goes after shaping */
export type Where = 'plan' | 'fridge' | 'room' | 'now';

export interface Branch {
  id: string;
  kind: 'loaf' | 'rolls';
  label: string;
  /** pieces in this branch: always 1 for a loaf */
  count: number;
  /** grams per piece */
  weight: number;
  where: Where;
  note: string;
  /** planned start of the oven chain, to move back to "as planned" */
  baseAt: number;
  /** the shaping step's title as planned */
  baseTitle?: string;
}

const LOAF_KINDS = ['shape', 'preheat', 'bake', 'uncover', 'outOfTin', 'done'];
const ROLL_KINDS = ['shapeRolls', 'enrich', 'bakeRolls', 'rollsDone'];
const CHAIN_KINDS = ['preheat', 'bake', 'uncover', 'outOfTin', 'done', 'bakeRolls', 'rollsDone'];
const SHAPE_KINDS = ['shape', 'shapeRolls'];

export const loafLabel = (n: number, many: boolean) => (many ? `כיכר ${n}` : 'הכיכר');

export function chainStart(steps: Step[], track: string): number {
  const at = steps.filter((s) => s.track === track && CHAIN_KINDS.includes(s.kind)).map((s) => s.at);
  return at.length ? Math.min(...at) : 0;
}

/** Split the plan after the divide into one branch per loaf and one for the rolls. */
export function withTracks(steps: Step[], input: PlanInput, total: number): { steps: Step[]; branches: Branch[] } {
  const sp = splitOf(total, input.loaves, input.loafWeight ?? 900, input.rolls);
  const branches: Branch[] = [];
  const out: Step[] = [];
  const many = input.loaves > 1;
  for (let i = 0; i < input.loaves; i++) {
    branches.push({ id: `L${i + 1}`, kind: 'loaf', label: loafLabel(i + 1, many), count: 1, weight: sp.loafWeight, where: 'plan', note: '', baseAt: 0 });
  }
  if (input.rolls > 0) {
    branches.push({ id: 'rolls', kind: 'rolls', label: 'לחמניות', count: input.rolls, weight: sp.rollWeight, where: 'plan', note: '', baseAt: 0 });
  }
  for (const s of steps) {
    if (LOAF_KINDS.includes(s.kind) && !(s.kind === 'preheat' && input.loaves === 0)) {
      branches.filter((b) => b.kind === 'loaf').forEach((b, i) => {
        if (s.kind === 'preheat' && i > 0) return;
        out.push({ ...s, id: `${s.id}.${b.id}`, track: b.id, alarm: i === 0 ? s.alarm : false, title: many ? `${b.label}: ${s.title}` : s.title });
      });
    } else if (ROLL_KINDS.includes(s.kind) || (s.kind === 'preheat' && input.loaves === 0)) {
      out.push({ ...s, track: 'rolls' });
    } else out.push(s);
  }
  for (const b of branches) {
    b.baseAt = chainStart(out, b.id);
    b.baseTitle = out.find((s) => s.track === b.id && s.kind === 'shape')?.title;
  }
  return { steps: out.sort((a, b) => a.at - b.at), branches };
}

const stripFridge = (t: string) => t.replace(/\s?ו?למקרר$/, '');

/** Fridge / counter / bake now for one branch: the oven chain moves, the rest stays. */
export function setWhere(steps: Step[], branches: Branch[], id: string, where: Where, now: number, roomTempC = 24): { steps: Step[]; branches: Branch[] } {
  const b = branches.find((x) => x.id === id);
  if (!b) throw new RangeError(`unknown branch ${id}`);
  const shape = steps.find((s) => s.track === id && SHAPE_KINDS.includes(s.kind));
  const cur = chainStart(steps.filter((s) => s.doneAt === undefined), id);
  const proof = 90 * MIN * tempFactor(roomTempC);
  const start =
    where === 'now' ? now + 15 * MIN
    : where === 'room' ? Math.max(now, (shape?.at ?? now) + proof)
    : b.baseAt;
  const delta = cur ? start - cur : 0;
  const next = steps.map((s) => {
    if (s.track !== id || s.doneAt !== undefined) return s;
    if (CHAIN_KINDS.includes(s.kind)) return { ...s, at: s.at + delta };
    if (s.kind === 'shape' && b.baseTitle) {
      const base = stripFridge(b.baseTitle);
      return { ...s, title: where === 'plan' ? b.baseTitle : where === 'fridge' ? `${base} ולמקרר` : base + (where === 'room' ? ' ולהתפיח בחוץ' : ' ולאפות מיד') };
    }
    return s;
  });
  return { steps: next.sort((a, c) => a.at - c.at), branches: branches.map((x) => (x.id === id ? { ...x, where } : x)) };
}

/** Recompute the rolls' weight after a loaf weight or the rolls count changed. */
export function resplit(steps: Step[], branches: Branch[], total: number): { steps: Step[]; branches: Branch[] } {
  const loafG = branches.filter((b) => b.kind === 'loaf').reduce((a, b) => a + b.weight, 0);
  const rolls = branches.find((b) => b.kind === 'rolls');
  if (!rolls || rolls.count <= 0) return { steps, branches };
  const w = Math.max(0, (total - loafG) / rolls.count);
  const g = Math.round(w);
  return {
    branches: branches.map((b) => (b.kind === 'rolls' ? { ...b, weight: w } : b)),
    steps: steps.map((s) => s.kind !== 'shapeRolls' || s.doneAt !== undefined ? s : {
      ...s,
      title: `לעצב ${rolls.count} לחמניות (${g} ג' כל אחת)`,
      note: s.note?.replace(/^לחתוך \d+ חתיכות של כ־\d+ ג'/, `לחתוך ${rolls.count} חתיכות של כ־${g} ג'`),
    }),
  };
}

export function setWeight(steps: Step[], branches: Branch[], id: string, weight: number, total: number) {
  return resplit(steps, branches.map((b) => (b.id === id && b.kind === 'loaf' ? { ...b, weight } : b)), total);
}

export function setRollCount(steps: Step[], branches: Branch[], count: number, total: number) {
  return resplit(steps, branches.map((b) => (b.kind === 'rolls' ? { ...b, count: Math.max(1, count) } : b)), total);
}

/** One more loaf, copied from the first loaf's steps. */
export function addLoaf(steps: Step[], branches: Branch[], total: number) {
  const loaves = branches.filter((b) => b.kind === 'loaf');
  const from = loaves[0];
  if (!from) return { steps, branches };
  const n = Math.max(...loaves.map((b) => Number(b.id.slice(1)))) + 1;
  const nb: Branch = { ...from, id: `L${n}`, label: `כיכר ${n}`, where: 'plan', note: '' };
  const copies = steps
    .filter((s) => s.track === from.id && s.doneAt === undefined && s.kind !== 'preheat')
    .map((s) => ({ ...s, id: `${s.id}+${nb.id}`, track: nb.id, alarm: false, title: `${nb.label}: ${s.title.replace(/^[^:]+: /, '')}` }));
  const labelled = loaves.length === 1 ? steps.map((s) => s.track === from.id && !s.title.startsWith('כיכר') ? { ...s, title: `${from.label.replace('הכיכר', 'כיכר 1')}: ${s.title}` } : s) : steps;
  const bs = branches.map((b) => (b.id === from.id && b.label === 'הכיכר' ? { ...b, label: 'כיכר 1' } : b));
  return resplit([...labelled, ...copies].sort((a, b) => a.at - b.at), [...bs.filter((b) => b.kind === 'loaf'), nb, ...bs.filter((b) => b.kind !== 'loaf')], total);
}

export function removeBranch(steps: Step[], branches: Branch[], id: string, total: number) {
  return resplit(steps.filter((s) => s.track !== id), branches.filter((b) => b.id !== id), total);
}

export function setTrackAlarms(steps: Step[], id: string, on: boolean): Step[] {
  return steps.map((s) => (s.track === id && s.doneAt === undefined ? { ...s, alarm: on } : s));
}

export function setUserNote(steps: Step[], id: string, userNote: string): Step[] {
  return steps.map((s) => (s.id === id ? { ...s, userNote } : s));
}

/** A free step or note, anywhere in the plan. */
export function addCustom(steps: Step[], c: { title: string; at: number; note?: string; track?: string; alarm?: boolean }): Step[] {
  const id = `c${Date.now().toString(36)}${steps.length}`;
  return [...steps, { id, kind: 'custom' as const, title: c.title, at: c.at, alarm: c.alarm ?? false, note: c.note, track: c.track }].sort((a, b) => a.at - b.at);
}

export function removeStep(steps: Step[], id: string): Step[] {
  return steps.filter((s) => s.id !== id || s.kind !== 'custom');
}

/** The "here the bake splits" text for the current branches. */
export function branchSummary(branches: Branch[]): string {
  const loaves = branches.filter((b) => b.kind === 'loaf');
  const rolls = branches.find((b) => b.kind === 'rolls');
  const same = loaves.every((b) => b.weight === loaves[0]?.weight);
  return [
    loaves.length > 0 && (same ? `${loaves.length} כיכרות × ${Math.round(loaves[0]!.weight)} ג'` : loaves.map((b) => `${Math.round(b.weight)} ג'`).join(' + ')),
    rolls && `${rolls.count} לחמניות × ${Math.round(rolls.weight)} ג'`,
  ].filter(Boolean).join(' + ');
}
