import { useEffect, useState } from 'preact/hooks';
import type { Step, StarterType } from '../../core/src/index';

export interface Starter {
  name: string;
  type: StarterType;
  hydration: number;
  /** epoch ms of the last feeding */
  lastFedAt: number;
  inFridge: boolean;
}

export interface ActivePlan {
  title: string;
  createdAt: number;
  steps: Step[];
  amounts: { name: string; grams: number }[];
  build: string;
  /** previous steps, for undo */
  undo?: Step[];
}

export interface State {
  starter: Starter;
  plan: ActivePlan | null;
  roomTempC: number;
  history: { title: string; finishedAt: number }[];
}

const KEY = 'machmetzet.v1';
const DAY = 86_400_000;

const initial = (): State => ({
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
const listeners = new Set<() => void>();

export function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
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
