/**
 * Sync logic that does not touch the network or the UI, so it can be tested:
 * per-item merge with conflict copies and tombstones, and an offline-first queue.
 */

export interface SyncRec {
  /** unique key, e.g. "recipe:abc", "plan", "starter" */
  key: string;
  /** epoch ms of the last local edit */
  updatedAt: number;
  /** tombstone: deleted on purpose */
  deleted?: boolean;
  data?: unknown;
}

export interface SyncDoc {
  v: 1;
  recs: SyncRec[];
}

export interface Conflict {
  key: string;
  /** key under which the losing version was kept (recipes), if any */
  keptAs?: string;
  reason: 'both-edited' | 'edit-vs-delete';
}

/** stable string hash of the data (key order does not matter) */
export function hashOf(data: unknown): string {
  const s = JSON.stringify(data, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  ) ?? 'null';
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

const recHash = (r: SyncRec | undefined): string | undefined => (r ? (r.deleted ? 'deleted' : hashOf(r.data)) : undefined);

/**
 * Three-way merge by item. `base` is the hash each item had at the last successful sync
 * (undefined: never synced). Rules:
 *  - only one side has it: keep it (a missing item is never treated as a delete, only a tombstone is)
 *  - same content: keep the newer record
 *  - only one side changed since base: that side wins
 *  - both changed: the newer wins; for recipes the other version is kept as a copy
 *  - one side deleted, the other edited: the edit wins, the deletion is not applied
 */
export function mergeSets(
  local: SyncRec[],
  remote: SyncRec[],
  base: Record<string, string>,
  now = Date.now(),
  newId: () => string = () => Math.random().toString(36).slice(2, 8),
): { recs: SyncRec[]; conflicts: Conflict[] } {
  const L = new Map(local.map((r) => [r.key, r]));
  const R = new Map(remote.map((r) => [r.key, r]));
  const recs: SyncRec[] = [];
  const conflicts: Conflict[] = [];
  for (const key of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(key);
    const r = R.get(key);
    if (!l || !r) {
      recs.push((l ?? r)!);
      continue;
    }
    const lh = recHash(l);
    const rh = recHash(r);
    if (lh === rh) {
      recs.push(l.updatedAt >= r.updatedAt ? l : r);
      continue;
    }
    const b = base[key];
    if (lh === b) {
      recs.push(r);
      continue;
    }
    if (rh === b) {
      recs.push(l);
      continue;
    }
    // both changed since the last sync
    if (l.deleted || r.deleted) {
      const live = l.deleted ? r : l;
      recs.push({ ...live, updatedAt: now });
      conflicts.push({ key, reason: 'edit-vs-delete' });
      continue;
    }
    const [win, lose] = l.updatedAt >= r.updatedAt ? [l, r] : [r, l];
    recs.push(win);
    let keptAs: string | undefined;
    if (key.startsWith('recipe:')) {
      keptAs = `recipe:${newId()}`;
      const d = lose.data as { id?: string; name?: string; fav?: boolean };
      recs.push({ key: keptAs, updatedAt: now, data: { ...d, id: keptAs.slice(7), name: `${d?.name ?? ''} (עותק מסנכרון)`, fav: false } });
    }
    conflicts.push({ key, keptAs, reason: 'both-edited' });
  }
  recs.sort((a, b) => (a.key < b.key ? -1 : 1));
  return { recs, conflicts };
}

/** tombstones older than this are dropped on merge */
export const TOMBSTONE_MS = 90 * 86_400_000;
export const dropOldTombstones = (recs: SyncRec[], now = Date.now()): SyncRec[] => recs.filter((r) => !(r.deleted && now - r.updatedAt > TOMBSTONE_MS));

/**
 * Compare the current items with what was seen last time: new or changed items get a new
 * updatedAt, vanished items become tombstones. `prev` is the previous record list.
 */
export function trackChanges(prev: SyncRec[], items: Map<string, unknown>, now = Date.now()): SyncRec[] {
  const P = new Map(prev.map((r) => [r.key, r]));
  const out: SyncRec[] = [];
  for (const [key, data] of items) {
    const p = P.get(key);
    out.push(p && !p.deleted && hashOf(p.data) === hashOf(data) ? p : { key, updatedAt: now, data });
  }
  for (const p of prev) if (!items.has(p.key)) out.push(p.deleted ? p : { key: p.key, updatedAt: now, deleted: true });
  return out;
}

// ---------- offline-first queue ----------

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';

export interface Remote {
  /** null when nothing is stored yet */
  pull(): Promise<SyncDoc | null>;
  push(doc: SyncDoc): Promise<void>;
}

export interface EngineDeps {
  remote: Remote;
  isOnline(): boolean;
  /** current local records (already change-tracked) */
  getLocal(): SyncRec[];
  /** apply the merged result locally and remember the base hashes */
  apply(recs: SyncRec[], conflicts: Conflict[]): void;
  getBase(): Record<string, string>;
  now?: () => number;
  /** retry later; returns a cancel function */
  later(fn: () => void, ms: number): () => void;
}

const BACKOFF = [15_000, 30_000, 60_000, 120_000, 300_000, 900_000];

export class SyncEngine {
  status: SyncStatus = 'idle';
  lastSyncedAt?: number;
  lastError?: string;
  pending = false;
  private fails = 0;
  private cancel?: () => void;
  private running = false;
  onChange: () => void = () => undefined;

  constructor(private d: EngineDeps) {}

  private set(s: SyncStatus) {
    this.status = s;
    this.onChange();
  }

  /** local data changed: remember to sync, try now if we can */
  markDirty(): void {
    this.pending = true;
    this.set(this.d.isOnline() ? 'pending' : 'offline');
    void this.run();
  }

  /** back online, app resumed, or a timer: try if there is something to do */
  async run(force = false): Promise<void> {
    if (this.running || (!this.pending && !force)) return;
    if (!this.d.isOnline()) {
      this.set('offline');
      return;
    }
    this.running = true;
    this.cancel?.();
    this.set('syncing');
    try {
      const remote = await this.d.remote.pull();
      const local = this.d.getLocal();
      const { recs, conflicts } = mergeSets(local, remote?.recs ?? [], this.d.getBase(), (this.d.now ?? Date.now)());
      const merged = dropOldTombstones(recs, (this.d.now ?? Date.now)());
      await this.d.remote.push({ v: 1, recs: merged });
      this.d.apply(merged, conflicts);
      this.pending = false;
      this.fails = 0;
      this.lastError = undefined;
      this.lastSyncedAt = (this.d.now ?? Date.now)();
      this.set('synced');
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.pending = true;
      const wait = BACKOFF[Math.min(this.fails++, BACKOFF.length - 1)]!;
      this.cancel = this.d.later(() => void this.run(), wait);
      this.set(this.d.isOnline() ? 'error' : 'offline');
    } finally {
      this.running = false;
    }
  }
}
