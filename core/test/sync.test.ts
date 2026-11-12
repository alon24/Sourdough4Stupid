import { describe, expect, it } from 'vitest';
import { hashOf, mergeSets, SyncEngine, trackChanges, type SyncDoc, type SyncRec } from '../src/sync';

const rec = (key: string, data: unknown, updatedAt: number, deleted?: boolean): SyncRec => ({ key, data, updatedAt, ...(deleted ? { deleted } : {}) });

describe('hashOf', () => {
  it('ignores key order', () => expect(hashOf({ a: 1, b: { c: 2, d: 3 } })).toBe(hashOf({ b: { d: 3, c: 2 }, a: 1 })));
  it('differs on content', () => expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 })));
});

describe('mergeSets', () => {
  const id = () => 'copy1';
  it('keeps items that exist on one side only', () => {
    const { recs } = mergeSets([rec('recipe:a', { n: 1 }, 1)], [rec('recipe:b', { n: 2 }, 1)], {});
    expect(recs.map((r) => r.key)).toEqual(['recipe:a', 'recipe:b']);
  });
  it('takes the side that changed since base', () => {
    const base = { 'recipe:a': hashOf({ n: 1 }) };
    const { recs, conflicts } = mergeSets([rec('recipe:a', { n: 1 }, 1)], [rec('recipe:a', { n: 2 }, 5)], base);
    expect(recs[0]!.data).toEqual({ n: 2 });
    expect(conflicts).toEqual([]);
  });
  it('both edited: newer wins, recipe loser kept as a copy', () => {
    const base = { 'recipe:a': hashOf({ id: 'a', name: 'x' }) };
    const { recs, conflicts } = mergeSets([rec('recipe:a', { id: 'a', name: 'local' }, 9)], [rec('recipe:a', { id: 'a', name: 'remote' }, 5)], base, 10, id);
    expect((recs.find((r) => r.key === 'recipe:a')!.data as { name: string }).name).toBe('local');
    const copy = recs.find((r) => r.key === 'recipe:copy1')!;
    expect((copy.data as { name: string; id: string }).name).toContain('remote');
    expect((copy.data as { id: string }).id).toBe('copy1');
    expect(conflicts).toEqual([{ key: 'recipe:a', keptAs: 'recipe:copy1', reason: 'both-edited' }]);
  });
  it('both edited non-recipe: newer wins, conflict reported', () => {
    const { recs, conflicts } = mergeSets([rec('plan', { s: 1 }, 3)], [rec('plan', { s: 2 }, 8)], { plan: hashOf({ s: 0 }) });
    expect(recs).toHaveLength(1);
    expect(recs[0]!.data).toEqual({ s: 2 });
    expect(conflicts[0]!.reason).toBe('both-edited');
  });
  it('never silently deletes an edit', () => {
    const base = { 'recipe:a': hashOf({ n: 1 }) };
    const { recs, conflicts } = mergeSets([rec('recipe:a', undefined, 9, true)], [rec('recipe:a', { n: 2 }, 5)], base, 10);
    expect(recs[0]!.deleted).toBeUndefined();
    expect(recs[0]!.data).toEqual({ n: 2 });
    expect(conflicts[0]!.reason).toBe('edit-vs-delete');
  });
  it('applies a delete when the other side did not change', () => {
    const base = { 'recipe:a': hashOf({ n: 1 }) };
    const { recs } = mergeSets([rec('recipe:a', undefined, 9, true)], [rec('recipe:a', { n: 1 }, 1)], base);
    expect(recs[0]!.deleted).toBe(true);
  });
});

describe('trackChanges', () => {
  it('bumps changed, keeps same, tombstones vanished', () => {
    const prev = [rec('a', 1, 1), rec('b', 2, 1), rec('c', 3, 1)];
    const out = trackChanges(prev, new Map<string, unknown>([['a', 1], ['b', 22]]), 100);
    expect(out.find((r) => r.key === 'a')!.updatedAt).toBe(1);
    expect(out.find((r) => r.key === 'b')!.updatedAt).toBe(100);
    expect(out.find((r) => r.key === 'c')).toMatchObject({ deleted: true, updatedAt: 100 });
  });
});

describe('offline queue', () => {
  function setup() {
    let online = false;
    let stored: SyncDoc | null = null;
    let local: SyncRec[] = [rec('recipe:a', { n: 1 }, 1)];
    let base: Record<string, string> = {};
    let failPush = false;
    const timers: (() => void)[] = [];
    const e = new SyncEngine({
      remote: {
        pull: async () => stored,
        push: async (d) => {
          if (failPush) throw new Error('boom');
          stored = d;
        },
      },
      isOnline: () => online,
      getLocal: () => local,
      getBase: () => base,
      apply: (recs) => {
        local = recs;
        base = Object.fromEntries(recs.filter((r) => !r.deleted).map((r) => [r.key, hashOf(r.data)]));
      },
      later: (fn) => {
        timers.push(fn);
        return () => undefined;
      },
    });
    return { e, timers, get stored() { return stored; }, setOnline: (v: boolean) => (online = v), setFail: (v: boolean) => (failPush = v), setLocal: (r: SyncRec[]) => (local = r) };
  }
  it('queues while offline and syncs when the network returns', async () => {
    const s = setup();
    s.e.markDirty();
    await s.e.run();
    expect(s.e.status).toBe('offline');
    expect(s.e.pending).toBe(true);
    expect(s.stored).toBeNull();
    s.setOnline(true);
    await s.e.run(); // the "online" event
    expect(s.e.status).toBe('synced');
    expect(s.e.pending).toBe(false);
    expect(s.stored!.recs[0]!.key).toBe('recipe:a');
  });
  it('retries with backoff after a failure and keeps the change queued', async () => {
    const s = setup();
    s.setOnline(true);
    s.setFail(true);
    s.e.markDirty();
    await new Promise((r) => setTimeout(r, 0));
    expect(s.e.status).toBe('error');
    expect(s.e.pending).toBe(true);
    expect(s.timers).toHaveLength(1);
    s.setFail(false);
    s.timers[0]!();
    await new Promise((r) => setTimeout(r, 0));
    expect(s.e.status).toBe('synced');
    expect(s.stored).not.toBeNull();
  });
  it('pulls the other device\'s data in', async () => {
    const s = setup();
    s.setOnline(true);
    await s.e.run(true);
    s.setLocal([]);
    await s.e.run(true);
    expect(s.e.status).toBe('synced');
  });
});
