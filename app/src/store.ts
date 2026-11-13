import { useEffect, useState } from 'preact/hooks';
import { alarmOps, fixTitleHe, type PlanInput, registerFlours, type FlourInfo, type AlarmOp, type Reading, type Step, type Branch, type Item, type StarterType } from '../../core/src/index';

/** Provided by the Android wrapper (real alarm clock). Absent in the browser. */
declare global {
  interface Window {
    SourdoughAlarms?: { apply(ops: AlarmOp[]): void };
  }
}

export interface Starter {
  name: string;
  type: StarterType;
  hydration: number;
  /** epoch ms of the last feeding */
  lastFedAt: number;
  inFridge: boolean;
  /** grams on hand */
  grams?: number;
  /** reported weak or sluggish: needs strengthening feeds */
  weak?: boolean;
  /** false or missing until the baker has said what state the starter is in */
  known?: boolean;
  /** the baker has no starter yet */
  none?: boolean;
}

export interface ActivePlan {
  title: string;
  createdAt: number;
  steps: Step[];
  /** what the plan was made from, so the start questionnaire can re-plan */
  input?: PlanInput;
  /** the saved recipe this bake started from */
  recipeId?: string;
  /** what to cut at the end of the bulk, always shown in the plan */
  split?: string;
  /** additions that go into one portion only at the split (olive oil for the pizza) */
  splitNotes?: string[];
  amounts: { name: string; grams: number }[];
  build: string;
  /** previous steps, for undo */
  undo?: Step[];
  kneading?: 'hand' | 'machine';
  /** start of the bulk and its length at 24°C, for temperature-aware retiming */
  bulk?: { startAt: number; refMin: number; startC: number };
  readings?: Reading[];
  /** after the split: one branch per loaf and one for the rolls */
  branches?: Branch[];
  /** total dough, for recomputing the split */
  total?: number;
  /** photos taken during the bake (the pictures themselves are in IndexedDB) */
  photos?: PlanPhoto[];
}

export interface PlanPhoto {
  id: string;
  at: number;
  label: string;
  stepId?: string;
  risePct?: number;
}

export interface FlourPreset {
  id: string;
  name: string;
  items: { flour: string; grams: number }[];
}

export interface InclusionDef {
  id: string;
  name: string;
  /** fraction of total flour */
  pct: number;
  /** dried fruit that should be soaked first */
  soak: boolean;
}

/** Everything about a bake except when and what the starter is doing: a reusable template. */
export interface Recipe {
  id: string;
  name: string;
  fav: boolean;
  /** the recipe this one was derived from */
  derivedFrom?: string;
  loaves: number;
  rolls: number;
  weight: number;
  shape: 'free' | 'tin';
  inclusions: string[];
  kneading: 'hand' | 'machine';
  cold: boolean;
  folds?: number;
  foldGapMin?: number;
  autolyse?: boolean;
  rollEnrich?: 'none' | 'oil' | 'silan';
  hydration: number;
  /** flour mix as grams per flour */
  mix: { flour: string; grams: number }[];
  /** what the bake makes: loaves, rolls, pizza and so on, with each item's starter share */
  items?: Item[];
}

export const DEFAULT_INCLUSIONS: InclusionDef[] = [
  { id: 'olives', name: 'זיתים', pct: 0.18, soak: false },
  { id: 'cranberries', name: 'חמוציות', pct: 0.18, soak: true },
  { id: 'raisins', name: 'צימוקים', pct: 0.18, soak: true },
];

export type BakeStatus = 'success' | 'failed' | 'finished' | 'unfinished';

export interface HistoryEntry {
  title: string;
  finishedAt: number;
  /** how the bake went; entries from before this existed count as finished */
  status?: BakeStatus;
  notes?: string[];
  photos?: PlanPhoto[];
  readings?: Reading[];
  /** the recipe it came from, and the inclusions added just for this bake */
  recipeId?: string;
  inclusions?: string[];
}

export interface State {
  inclusions: InclusionDef[];
  recipes: Recipe[];
  flourPresets: FlourPreset[];
  customFlours: FlourInfo[];
  starter: Starter;
  /** the bake that is open in the plan tab */
  plan: ActivePlan | null;
  /** other bakes running at the same time */
  others: ActivePlan[];
  roomTempC: number;
  history: HistoryEntry[];
}

const KEY = 'machmetzet.v1';
const DAY = 86_400_000;

const initial = (): State => ({
  inclusions: DEFAULT_INCLUSIONS,
  recipes: [],
  flourPresets: [],
  customFlours: [],
  starter: { name: 'הסטארטר הקשה שלי', type: 'stiff', hydration: 0.5, lastFedAt: Date.now(), inFridge: true, known: false },
  plan: null,
  others: [],
  roomTempC: 24,
  history: [],
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = { ...initial(), ...(JSON.parse(raw) as Partial<State>) };
      // bakes saved with "1 לחמים" in their name: say it properly
      const fix = <T extends { title: string }>(x: T): T => ({ ...x, title: fixTitleHe(x.title) });
      return { ...st, plan: st.plan ? fix(st.plan) : st.plan, others: st.others.map(fix), history: st.history.map(fix) };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return initial();
}

let state = load();
registerFlours(state.customFlours);
const listeners = new Set<() => void>();

/** every running bake, the open one first */
export const allPlans = (s: State): ActivePlan[] => (s.plan ? [s.plan, ...s.others] : [...s.others]);

/** a bake's identity: when it was created */
export const planId = (p: ActivePlan): string => String(p.createdAt);

/** the steps of every bake as the phone's alarm clock sees them: ids carry the bake, titles carry its name when there are several */
export function alarmSteps(s: State): Step[] {
  const all = allPlans(s);
  return all.flatMap((p) => p.steps.map((x) => ({ ...x, id: `${planId(p)}:${x.id}`, title: all.length > 1 ? `${p.title} · ${x.title}` : x.title })));
}

/** change one running bake, wherever it is */
export function updatePlan(id: string, fn: (p: ActivePlan) => ActivePlan): void {
  const s = state;
  if (s.plan && planId(s.plan) === id) setState({ plan: fn(s.plan) });
  else setState({ others: s.others.map((p) => (planId(p) === id ? fn(p) : p)) });
}

/** open another running bake in the plan tab */
export function selectPlan(id: string): void {
  const all = allPlans(state);
  const p = all.find((x) => planId(x) === id);
  if (p) setState({ plan: p, others: all.filter((x) => x !== p) });
}

/** close one running bake, wherever it is: log it with a status and an optional closing note, or drop it (status null) */
export function closePlan(id: string, status: BakeStatus | null, endNote = ''): void {
  const p = allPlans(state).find((x) => planId(x) === id);
  if (!p) return;
  const notes = [
    ...(endNote.trim() ? [endNote.trim()] : []),
    ...(p.branches ?? []).filter((b) => b.note).map((b) => `${b.label}: ${b.note}`),
    ...p.steps.filter((s) => s.userNote).map((s) => `${s.title}: ${s.userNote}`),
    ...p.steps.filter((s) => s.kind === 'custom').map((s) => `${s.title}${s.note ? `: ${s.note}` : ''}`),
  ];
  const entry: HistoryEntry | null = status === null ? null : { title: p.title, finishedAt: Date.now(), status, ...(p.recipeId ? { recipeId: p.recipeId } : {}), ...(p.input?.inclusions?.length ? { inclusions: p.input.inclusions.map((i) => i.name) } : {}), ...(notes.length ? { notes } : {}), ...(p.photos?.length ? { photos: p.photos } : {}), ...(p.readings?.length ? { readings: p.readings } : {}) };
  const history = entry ? [entry, ...state.history] : state.history;
  if (state.plan && planId(state.plan) === id) setState({ plan: null, history });
  else setState({ others: state.others.filter((x) => planId(x) !== id), history });
}

/** start another bake without closing the one that is running */
export function addPlan(p: ActivePlan): void {
  setState({ plan: p, others: allPlans(state) });
}

export function setState(patch: Partial<State>): void {
  const before = alarmSteps(state);
  state = { ...state, ...patch };
  // closing the open bake opens the next one
  if (!state.plan && state.others.length > 0) state = { ...state, plan: state.others[0]!, others: state.others.slice(1) };
  if (patch.customFlours) registerFlours(state.customFlours);
  const after = alarmSteps(state);
  const ops = alarmOps(before, after);
  if (ops.length > 0) {
    try {
      window.SourdoughAlarms?.apply(ops);
    } catch {
      /* the plan still works without the native alarm */
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* keep working in memory */
  }
  listeners.forEach((l) => l());
}

export const getState = (): State => state;

/** for modules outside the UI (sync) */
export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** true when this device has saved user data before (used so a fresh install never overrides synced data) */
export const hadSavedState = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

export function useStore(): State {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}

export const daysSinceFed = (s: Starter, now = Date.now()): number => Math.floor((now - s.lastFedAt) / DAY);
