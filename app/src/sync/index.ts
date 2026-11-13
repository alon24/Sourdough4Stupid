import { useEffect, useState } from 'preact/hooks';
import { hashOf, SyncEngine, trackChanges, type Conflict, type SyncRec } from '../../../core/src/index';
import { allPlans, getState, hadSavedState, planId, setState, subscribe, type ActivePlan, type State } from '../store';
import { getToken, isConnected } from './auth';
import { driveRemote } from './drive';

const META = 'machmetzet.sync.meta';

interface Meta {
  recs: SyncRec[];
  base: Record<string, string>;
  lastSyncedAt?: number;
  conflicts: (Conflict & { at: number })[];
}

const loadMeta = (): Meta => {
  try {
    const m = JSON.parse(localStorage.getItem(META) ?? '') as Meta;
    if (m && Array.isArray(m.recs)) return { ...m, conflicts: m.conflicts ?? [], base: m.base ?? {} };
  } catch {
    /* fresh */
  }
  return { recs: [], base: {}, conflicts: [] };
};
let meta = loadMeta();
const saveMeta = () => {
  try {
    localStorage.setItem(META, JSON.stringify(meta));
  } catch {
    /* in memory only */
  }
};

/** What gets synced: everything except per-device things (room temperature). */
export function itemsOf(s: State): Map<string, unknown> {
  const m = new Map<string, unknown>();
  s.recipes.forEach((r) => m.set(`recipe:${r.id}`, r));
  s.flourPresets.forEach((r) => m.set(`preset:${r.id}`, r));
  s.customFlours.forEach((r) => m.set(`flour:${r.id}`, r));
  s.inclusions.forEach((r) => m.set(`incl:${r.id}`, r));
  s.history.forEach((h) => m.set(`history:${h.finishedAt}:${hashOf(h.title)}`, h));
  m.set('starter', s.starter);
  // every running bake is its own record; which one is open stays on the device
  allPlans(s).forEach((p) => m.set(`plan:${planId(p)}`, p));
  return m;
}

/** Inverse of itemsOf: rebuild the state arrays from live records. */
export function patchFrom(recs: SyncRec[], cur: State): Partial<State> {
  const live = recs.filter((r) => !r.deleted);
  const of = <T,>(prefix: string) => live.filter((r) => r.key.startsWith(prefix)).map((r) => r.data as T);
  const seen = new Set<number>();
  const plans = live
    .filter((r) => r.key === 'plan' || r.key.startsWith('plan:'))
    .map((r) => r.data as ActivePlan)
    .filter((p) => !seen.has(p.createdAt) && seen.add(p.createdAt))
    .sort((a, b) => a.createdAt - b.createdAt);
  const open = plans.find((p) => cur.plan && p.createdAt === cur.plan.createdAt) ?? plans[0] ?? null;
  const starter = live.find((r) => r.key === 'starter')?.data as State['starter'] | undefined;
  const inclusions = of<State['inclusions'][number]>('incl:');
  return {
    recipes: of<State['recipes'][number]>('recipe:'),
    flourPresets: of<State['flourPresets'][number]>('preset:'),
    customFlours: of<State['customFlours'][number]>('flour:'),
    inclusions: inclusions.length ? inclusions : cur.inclusions,
    history: of<State['history'][number]>('history:').sort((a, b) => b.finishedAt - a.finishedAt),
    starter: starter ?? cur.starter,
    plan: open,
    others: plans.filter((p) => p !== open),
  };
}

let applying = false;
const track = () => {
  // a device that never saved anything is "older than everything": its defaults must not beat synced data
  meta.recs = trackChanges(meta.recs, itemsOf(getState()), hadSavedState() || meta.recs.length ? Date.now() : 0);
  saveMeta();
};

export const engine = new SyncEngine({
  remote: driveRemote(getToken),
  isOnline: () => navigator.onLine,
  getLocal: () => {
    track();
    return meta.recs;
  },
  getBase: () => meta.base,
  apply: (recs, conflicts) => {
    meta.recs = recs;
    meta.base = Object.fromEntries(recs.map((r) => [r.key, r.deleted ? 'deleted' : hashOf(r.data)]));
    meta.lastSyncedAt = Date.now();
    meta.conflicts = [...conflicts.map((c) => ({ ...c, at: Date.now() })), ...meta.conflicts].slice(0, 20);
    saveMeta();
    applying = true;
    try {
      setState(patchFrom(recs, getState()));
    } finally {
      applying = false;
    }
  },
  later: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
});
engine.lastSyncedAt = meta.lastSyncedAt;

let debounce: ReturnType<typeof setTimeout> | undefined;
let started = false;

/** Call once at startup. Does nothing until the user has signed in. */
export function startSync(): void {
  if (started) return;
  started = true;
  const kick = () => isConnected() && void engine.run(true);
  subscribe(() => {
    if (applying || !isConnected()) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => engine.markDirty(), 2500);
  });
  addEventListener('online', kick);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && kick());
  setInterval(() => isConnected() && engine.pending && void engine.run(), 5 * 60_000);
  setTimeout(kick, 1500);
}

export const syncMeta = (): Meta => meta;

/** UI hook: re-render on every engine change */
export function useSync() {
  const [, tick] = useState(0);
  useEffect(() => {
    const prev = engine.onChange;
    engine.onChange = () => {
      prev();
      tick((n) => n + 1);
    };
    return () => void (engine.onChange = prev);
  }, []);
  return engine;
}
