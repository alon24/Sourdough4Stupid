import { useEffect, useState } from 'preact/hooks';
import { alarmOps, type PlanInput, registerFlours, type FlourInfo, type AlarmOp, type Reading, type Step, type StarterType } from '../../core/src/index';

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
}

export interface ActivePlan {
  title: string;
  createdAt: number;
  steps: Step[];
  /** what the plan was made from, so the start questionnaire can re-plan */
  input?: PlanInput;
  amounts: { name: string; grams: number }[];
  build: string;
  /** previous steps, for undo */
  undo?: Step[];
  kneading?: 'hand' | 'machine';
  /** start of the bulk and its length at 24°C, for temperature-aware retiming */
  bulk?: { startAt: number; refMin: number; startC: number };
  readings?: Reading[];
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
  hydration: number;
  /** flour mix as grams per flour */
  mix: { flour: string; grams: number }[];
}

export const DEFAULT_INCLUSIONS: InclusionDef[] = [
  { id: 'olives', name: 'זיתים', pct: 0.18, soak: false },
  { id: 'cranberries', name: 'חמוציות', pct: 0.18, soak: true },
  { id: 'raisins', name: 'צימוקים', pct: 0.18, soak: true },
];

export interface State {
  inclusions: InclusionDef[];
  recipes: Recipe[];
  flourPresets: FlourPreset[];
  customFlours: FlourInfo[];
  starter: Starter;
  plan: ActivePlan | null;
  roomTempC: number;
  history: { title: string; finishedAt: number }[];
}

const KEY = 'machmetzet.v1';
const DAY = 86_400_000;

const initial = (): State => ({
  inclusions: DEFAULT_INCLUSIONS,
  recipes: [],
  flourPresets: [],
  customFlours: [],
  starter: { name: 'הסטארטר הקשה שלי', type: 'stiff', hydration: 0.5, lastFedAt: Date.now() - 9 * DAY, inFridge: true },
  plan: null,
  roomTempC: 24,
  history: [],
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial(), ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return initial();
}

let state = load();
registerFlours(state.customFlours);
const listeners = new Set<() => void>();

export function setState(patch: Partial<State>): void {
  const before = state.plan?.steps ?? [];
  state = { ...state, ...patch };
  if (patch.customFlours) registerFlours(state.customFlours);
  const after = state.plan?.steps ?? [];
  if (before !== after) {
    const ops = alarmOps(before, after);
    if (ops.length > 0) {
      try {
        window.SourdoughAlarms?.apply(ops);
      } catch {
        /* the plan still works without the native alarm */
      }
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
