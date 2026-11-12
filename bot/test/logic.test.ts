import { describe, expect, it } from 'vitest';
import type { Step } from '../../core/src/plan.js';
import { applyAction, dueSteps, putPlan, type Link } from '../src/logic.js';

const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 1, 8, 0);
const mk = (id: string, minFromT0: number, extra: Partial<Step> = {}): Step => ({
  id, kind: 'fold', title: `step ${id}`, at: T0 + minFromT0 * MIN, alarm: true, ...extra,
});
const link = (steps: Step[]): Link => ({ chatId: 1, tz: 'UTC', rev: 3, steps, notified: {} });
const base = () => link([mk('a', 0), mk('b', 30), mk('c', 90)]);

describe('dueSteps', () => {
  it('returns due, unannounced, recent steps only', () => {
    const l = base();
    expect(dueSteps(l, T0 + 5 * MIN).map((s) => s.id)).toEqual(['a']);
    l.notified.a = T0;
    expect(dueSteps(l, T0 + 5 * MIN)).toEqual([]);
    expect(dueSteps(base(), T0 + 5 * 60 * MIN).map((s) => s.id)).toEqual([]); // stale
  });
  it('announces a moved step again', () => {
    const l = base();
    l.notified.a = T0 - 10 * MIN; // announced for an older time
    expect(dueSteps(l, T0 + MIN).map((s) => s.id)).toEqual(['a']);
  });
});

describe('applyAction', () => {
  it('done on time keeps the plan, bumps rev', () => {
    const r = applyAction(base(), 'ok', 'a', T0);
    expect(r.changed).toBe(true);
    expect(r.link.rev).toBe(4);
    expect(r.link.steps.find((s) => s.id === 'b')!.at).toBe(T0 + 30 * MIN);
    expect(r.text).toContain('הבא: step b');
  });
  it('done late: later steps keep their waits from the moment it was marked done', () => {
    const r = applyAction(base(), 'ok', 'a', T0 + 20 * MIN);
    expect(r.link.steps.find((s) => s.id === 'b')!.at).toBe(T0 + 50 * MIN);
    expect(r.link.steps.find((s) => s.id === 'c')!.at).toBe(T0 + 110 * MIN);
  });
  it('+30 moves the step and everything after it', () => {
    const r = applyAction(base(), 'p30', 'a', T0 + MIN);
    // counted from now (T0+1): a -> T0+1+30
    expect(r.link.steps.find((s) => s.id === 'a')!.at).toBe(T0 + 31 * MIN);
    expect(r.link.steps.find((s) => s.id === 'c')!.at).toBe(T0 + 121 * MIN);
  });
  it('snooze late never lands in the past', () => {
    const r = applyAction(base(), 'sn', 'a', T0 + 25 * MIN);
    expect(r.link.steps.find((s) => s.id === 'a')!.at).toBe(T0 + 35 * MIN);
  });
  it('skip does not shift anything', () => {
    const r = applyAction(base(), 'skip', 'a', T0 + 20 * MIN);
    expect(r.link.steps.find((s) => s.id === 'b')!.at).toBe(T0 + 30 * MIN);
    expect(r.link.steps.find((s) => s.id === 'a')!.doneAt).toBe(T0);
  });
  it('ignores a second press and unknown steps', () => {
    const once = applyAction(base(), 'ok', 'a', T0).link;
    expect(applyAction(once, 'ok', 'a', T0).changed).toBe(false);
    expect(applyAction(base(), 'ok', 'zzz', T0).changed).toBe(false);
  });
});

describe('putPlan', () => {
  it('accepts matching rev, rejects stale', () => {
    expect(putPlan(base(), [], 3).ok).toBe(true);
    const stale = putPlan(base(), [], 2);
    expect(stale.ok).toBe(false);
  });
});
