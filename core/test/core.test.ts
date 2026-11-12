import { describe, expect, it } from 'vitest';
import {
  alarmOps, bakeProfile, complete, setAlarm, hydrationAdvice, suggestHydration, dough, doughForTin, feed, peakHours, plan, PRESETS, ratioForWindow, resumeAt,
  revivalFeeds, seedFor, shift, split, waterTemp,
} from '../src/index.js';

const HOUR = 3_600_000;

describe('starter', () => {
  it('splits a stiff starter into flour and water', () => {
    const s = split(200, 0.5);
    expect(s.flour).toBeCloseTo(133.33, 1);
    expect(s.water).toBeCloseTo(66.67, 1);
  });

  it('feeds 1:2:1 and keeps 50% hydration', () => {
    const f = feed(90, 0.5, { a: 2, b: 1 });
    expect(f.addFlour).toBe(180);
    expect(f.addWater).toBe(90);
    expect(f.total).toBe(360);
    expect(f.hydration).toBeCloseTo(0.5);
  });

  it('moves hydration toward the target when converting liquid to stiff', () => {
    const first = feed(20, 1, { a: 2, b: 1 });
    expect(first.hydration).toBeGreaterThan(0.5);
    const second = feed(20, first.hydration, { a: 2, b: 1 });
    expect(second.hydration).toBeLessThan(first.hydration);
    expect(second.hydration).toBeCloseTo(0.5, 1);
  });

  it('sizes the seed for 300 g at 1:2:1 (spec example)', () => {
    expect(seedFor(300, [{ a: 2, b: 1 }])).toBeCloseTo(90);
  });

  it('needs less seed over two feedings', () => {
    const one = seedFor(300, [{ a: 2, b: 2 }]);
    const two = seedFor(300, [{ a: 2, b: 2 }, { a: 2, b: 2 }]);
    expect(two).toBeCloseTo(one / 5);
  });

  it('peaks slower when cold, with higher ratios, and for stiff starters', () => {
    const base = peakHours({ type: 'liquid', a: 2 });
    expect(base).toBeCloseTo(6.5);
    expect(peakHours({ type: 'liquid', a: 2, tempC: 16 })).toBeCloseTo(13);
    expect(peakHours({ type: 'liquid', a: 5 })).toBeGreaterThan(base);
    expect(peakHours({ type: 'stiff', a: 2 })).toBeGreaterThan(base);
    expect(peakHours({ type: 'liquid', a: 2, speedFactor: 1.2 })).toBeCloseTo(7.8);
  });

  it('picks a ratio that fits a 10 hour window without overshooting', () => {
    for (const type of ['liquid', 'stiff'] as const) {
      for (const tempC of [18, 21, 24, 27, 30]) {
        const hydration = type === 'stiff' ? 0.5 : 1;
        const c = ratioForWindow(10, { type, hydration, tempC });
        const fastest = peakHours({ type, a: 1, tempC });
        if (fastest <= 10) expect(c.hours).toBeLessThanOrEqual(10);
        expect(c.ratio.b).toBeCloseTo(c.ratio.a * hydration);
      }
    }
    const warm = ratioForWindow(10, { type: 'liquid', hydration: 1, tempC: 28 });
    const cool = ratioForWindow(10, { type: 'liquid', hydration: 1, tempC: 20 });
    expect(warm.ratio.a).toBeGreaterThan(cool.ratio.a);
  });

  it('asks for revival feeds only after long fridge time', () => {
    expect(revivalFeeds(10)).toBe(0);
    expect(revivalFeeds(20)).toBe(1);
    expect(revivalFeeds(45)).toBe(2);
  });
});

describe('dough', () => {
  const spec = {
    pieces: [{ name: 'loaf', count: 2, weight: 900 }, { name: 'roll', count: 6, weight: 90 }],
    hydration: 0.72, salt: 0.02, levainPct: 0.2, levainHydration: 0.5,
    inclusions: [{ name: 'olives', pct: 0.2 }],
  };

  it('adds up to the dough weight', () => {
    const d = dough(spec);
    const sum = d.addFlour + d.addWater + d.levain + d.salt + d.inclusions[0]!.grams;
    expect(sum).toBeCloseTo(d.totalDough);
    expect(d.totalDough).toBeCloseTo(2340 * 1.02);
  });

  it('keeps true hydration the same for liquid and stiff levain', () => {
    const stiff = dough(spec);
    const liquid = dough({ ...spec, levainHydration: 1 });
    expect(stiff.totalWater / stiff.totalFlour).toBeCloseTo(0.72);
    expect(liquid.totalWater / liquid.totalFlour).toBeCloseTo(0.72);
    expect(liquid.addWater).toBeLessThan(stiff.addWater);
  });

  it('splits a flour blend', () => {
    const d = dough({ ...spec, flours: [{ name: 'white', pct: 0.7 }, { name: 'spelt', pct: 0.3 }] });
    expect(d.flours[0]!.grams + d.flours[1]!.grams).toBeCloseTo(d.addFlour);
    expect(() => dough({ ...spec, flours: [{ name: 'white', pct: 0.7 }] })).toThrow();
  });

  it('holds for many sizes and hydrations', () => {
    for (let count = 1; count <= 12; count++) {
      for (const hydration of [0.6, 0.65, 0.72, 0.8, 0.9]) {
        const d = dough({ ...spec, hydration, pieces: [{ name: 'loaf', count, weight: 850 }] });
        const sum = d.addFlour + d.addWater + d.levain + d.salt + d.inclusions[0]!.grams;
        expect(sum).toBeCloseTo(d.totalDough, 6);
        expect(d.addFlour).toBeGreaterThan(0);
        expect(d.addWater).toBeGreaterThan(0);
      }
    }
  });

  it('makes pizza dough from the preset', () => {
    const p = PRESETS.pizza;
    const d = dough({
      pieces: [{ name: 'pizza', count: 4, weight: p.pieceWeight }],
      hydration: p.hydration, salt: p.salt, levainPct: p.levainPct,
      levainHydration: 0.5, extras: [...p.extras], loss: 0,
    });
    expect(d.totalDough).toBe(1040);
    expect(d.extras[0]!.grams).toBeCloseTo(d.totalFlour * 0.02);
  });

  it('rejects an empty bake', () => {
    expect(() => dough({ ...spec, pieces: [] })).toThrow();
  });

  it('computes water temperature', () => {
    expect(waterTemp({ flour: 22, room: 22, levain: 22, friction: 1 })).toBe(33);
    expect(waterTemp({ flour: 22, room: 22, levain: 22, friction: 12 })).toBe(22);
  });
});

describe('plan', () => {
  const out = Date.UTC(2026, 10, 14, 7, 45); // Saturday 09:45 in Israel
  const input = {
    outOfOvenAt: out, loaves: 2, rolls: 6,
    starter: { type: 'stiff' as const, hydration: 0.5, daysInFridge: 9 },
    kneading: 'hand' as const,
    inclusions: [{ name: 'זיתים', pct: 0.2 }],
  };

  it('plans backward in order, ending at the target', () => {
    const p = plan(input, out - 72 * HOUR);
    const times = p.steps.map((s) => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(p.steps.find((s) => s.kind === 'done')!.at).toBe(out);
    expect(p.steps[0]!.kind).toBe('feed');
    expect(p.startsInPast).toBe(false);
  });

  it('uses the baking profile: 25 min covered, 20 uncovered', () => {
    const p = plan(input);
    const bake = p.steps.find((s) => s.kind === 'bake')!;
    const uncover = p.steps.find((s) => s.kind === 'uncover')!;
    expect(uncover.at - bake.at).toBe(25 * 60_000);
    expect(out - uncover.at).toBe(20 * 60_000);
  });

  it('feeds the starter about 10 hours before mixing, with enough for the dough', () => {
    const p = plan(input);
    const feedStep = p.steps.find((s) => s.kind === 'feed')!;
    const mix = p.steps.find((s) => s.kind === 'mix')!;
    const hours = (mix.at - feedStep.at) / HOUR;
    expect(hours).toBeLessThanOrEqual(10);
    expect(hours).toBeGreaterThan(6);
    const total = p.build.seed + p.build.addFlour + p.build.addWater;
    expect(total).toBeGreaterThanOrEqual(p.dough.levain + 30);
  });

  it('puts inclusions in the first fold and has 4 folds by hand, 2 by machine', () => {
    const hand = plan(input);
    expect(hand.steps.filter((s) => s.kind === 'fold')).toHaveLength(4);
    expect(hand.steps.find((s) => s.kind === 'fold')!.note).toContain('זיתים');
    const machine = plan({ ...input, kneading: 'machine' });
    expect(machine.steps.filter((s) => s.kind === 'fold')).toHaveLength(2);
  });

  it('adds revival feeds after a month in the fridge', () => {
    const p = plan({ ...input, starter: { ...input.starter, daysInFridge: 40 } });
    expect(p.steps.filter((s) => s.kind === 'revive')).toHaveLength(2);
    expect(p.steps[0]!.kind).toBe('revive');
  });

  it('flags a plan that should already have started', () => {
    expect(plan(input, out - HOUR).startsInPast).toBe(true);
  });

  it('bakes rolls alone when there are no loaves', () => {
    const p = plan({ ...input, loaves: 0 });
    expect(p.steps.some((s) => s.kind === 'bake')).toBe(false);
    expect(p.steps.find((s) => s.kind === 'rollsDone')!.at).toBe(out);
  });

  it('shifts later steps but never earlier or finished ones', () => {
    const p = plan(input);
    const i = p.steps.findIndex((s) => s.kind === 'mix');
    const moved = shift(p.steps, p.steps[i]!.id, 30);
    for (const s of p.steps) {
      const m = moved.find((x) => x.id === s.id)!;
      expect(m.at - s.at).toBe(s.at >= p.steps[i]!.at ? 30 * 60_000 : 0);
    }
    const only = shift(p.steps, p.steps[i]!.id, 30, false);
    expect(only.filter((s) => s.at !== p.steps.find((x) => x.id === s.id)!.at)).toHaveLength(1);
  });

  it('completing a step late keeps the following waits at their planned length', () => {
    const p = plan(input);
    const auto = p.steps.find((s) => s.kind === 'autolyse')!;
    const mix = p.steps.find((s) => s.kind === 'mix')!;
    const plannedWait = mix.at - auto.at;
    // the autolyse step is marked done 30 minutes late
    const late = auto.at + 30 * 60_000;
    const after = complete(p.steps, auto.id, late);
    const mix2 = after.find((s) => s.id === mix.id)!;
    expect(after.find((s) => s.id === auto.id)!.doneAt).toBe(late);
    expect(mix2.at - late).toBe(plannedWait);
    expect(after.find((s) => s.kind === 'done')!.at).toBe(out + 30 * 60_000);
    // steps already done never move again
    const again = shift(after, after.find((s) => s.kind === 'divide')!.id, 15);
    expect(again.find((s) => s.id === auto.id)!.at).toBe(after.find((s) => s.id === auto.id)!.at);
  });

  it('completing early leaves the oven time alone', () => {
    const p = plan(input);
    const mix = p.steps.find((s) => s.kind === 'mix')!;
    const after = complete(p.steps, mix.id, mix.at - 20 * 60_000);
    expect(after.find((s) => s.id === mix.id)!.doneAt).toBe(mix.at - 20 * 60_000);
    expect(after.find((s) => s.kind === 'done')!.at).toBe(out);
  });

  it('chains several late steps without drifting', () => {
    let steps = plan(input).steps;
    let totalLate = 0;
    for (const kind of ['autolyse', 'mix', 'divide'] as const) {
      const s = steps.find((x) => x.kind === kind)!;
      steps = complete(steps, s.id, s.at + 10 * 60_000);
      totalLate += 10;
    }
    expect(steps.find((s) => s.kind === 'done')!.at).toBe(out + totalLate * 60_000);
    const times = steps.map((s) => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('resumes from "I am here"', () => {
    const p = plan(input);
    const i = p.steps.findIndex((s) => s.kind === 'divide');
    const now = p.steps[i]!.at + 2 * HOUR;
    const r = resumeAt(p.steps, p.steps[i]!.id, now);
    expect(r.slice(0, i).every((s) => s.doneAt !== undefined && s.doneAt <= now)).toBe(true);
    expect(r[i]!.at).toBe(now);
    expect(r.find((s) => s.kind === 'done')!.at).toBe(out + 2 * HOUR);
  });
});

describe('bake profile', () => {
  it('keeps the usual 900 g bake: 240 for 25 covered, 230 for 20 open', () => {
    expect(bakeProfile(900)).toMatchObject({ coveredTemp: 240, coveredMin: 25, openTemp: 230, openMin: 20, totalMin: 45 });
  });

  it('bakes heavier loaves longer, never shorter', () => {
    expect(bakeProfile(1000).totalMin).toBe(50);
    expect(bakeProfile(1200).totalMin).toBe(60);
    let prev = 0;
    for (let w = 500; w <= 1500; w += 50) {
      const t = bakeProfile(w).totalMin;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('bakes tin loaves cooler and finishes them out of the tin', () => {
    const p = bakeProfile(1000, 'tin');
    expect(p.coveredTemp).toBe(230);
    expect(p.openTemp).toBe(210);
    expect(p.outOfTinMin).toBe(5);
  });

  it('sizes dough for a tin', () => {
    expect(doughForTin(1.8)).toBe(990);
  });

  it('plans a 1.2 kg tin loaf with its own steps', () => {
    const out = Date.UTC(2026, 10, 14, 7, 45);
    const p = plan({
      outOfOvenAt: out, loaves: 1, rolls: 0, loafWeight: 1200, loafShape: 'tin',
      starter: { type: 'stiff', hydration: 0.5, daysInFridge: 3 }, kneading: 'machine',
    });
    const bake = p.steps.find((s) => s.kind === 'bake')!;
    expect(out - bake.at).toBe(60 * 60_000);
    expect(p.steps.some((s) => s.kind === 'outOfTin')).toBe(true);
    expect(p.dough.totalDough).toBeCloseTo(1200 * 1.02);
  });
});

describe('flours and hydration', () => {
  it('suggests more water for whole wheat and less for spelt', () => {
    expect(suggestHydration([{ id: 'white', pct: 1 }])).toBe(0.7);
    expect(suggestHydration([{ id: 'white', pct: 0.8 }, { id: 'whole', pct: 0.2 }])).toBeCloseTo(0.75, 2);
    expect(suggestHydration([{ id: 'white', pct: 0.6 }, { id: 'spelt', pct: 0.4 }])).toBeCloseTo(0.68, 2);
  });

  it('rejects shares that do not add up and unknown flours', () => {
    expect(() => suggestHydration([{ id: 'white', pct: 0.5 }])).toThrow();
    expect(() => suggestHydration([{ id: 'nope', pct: 1 }])).toThrow();
  });

  it('judges the hydration you picked against the blend', () => {
    const blend = [{ id: 'white', pct: 0.8 }, { id: 'whole', pct: 0.2 }];
    expect(hydrationAdvice(blend, 0.68).level).toBe('low');
    expect(hydrationAdvice(blend, 0.68).diff).toBeCloseTo(-0.07, 2);
    expect(hydrationAdvice(blend, 0.76).level).toBe('ok');
    expect(hydrationAdvice([{ id: 'white', pct: 1 }], 0.8).level).toBe('high');
  });
});

describe('plan with a flour blend', () => {
  it('lists each flour in the dough', () => {
    const p = plan({
      outOfOvenAt: Date.UTC(2026, 10, 14, 7, 45), loaves: 2, rolls: 0, kneading: 'hand',
      starter: { type: 'stiff', hydration: 0.5, daysInFridge: 2 },
      hydration: 0.78, blend: [{ id: 'white', pct: 0.7 }, { id: 'whole', pct: 0.3 }],
    });
    expect(p.dough.flours.map((f) => f.name)).toEqual(['לבן', 'מלא']);
    expect(p.dough.flours[1]!.grams / p.dough.addFlour).toBeCloseTo(0.3);
    expect(p.dough.totalWater / p.dough.totalFlour).toBeCloseTo(0.78);
  });
});

describe('alarm sync', () => {
  const out = Date.UTC(2026, 10, 14, 7, 45);
  const base = () => plan({
    outOfOvenAt: out, loaves: 1, rolls: 0, kneading: 'hand',
    starter: { type: 'stiff', hydration: 0.5, daysInFridge: 2 },
  }).steps;

  it('sets every alarm on a new plan', () => {
    const steps = base();
    const ops = alarmOps([], steps);
    expect(ops.every((o) => o.op === 'set')).toBe(true);
    expect(ops).toHaveLength(steps.filter((s) => s.alarm).length);
  });

  it('reschedules exactly the alarms that moved', () => {
    const steps = base();
    const mix = steps.find((s) => s.kind === 'mix')!;
    const moved = shift(steps, mix.id, 20);
    const ops = alarmOps(steps, moved);
    const later = steps.filter((s) => s.alarm && s.at >= mix.at).length;
    expect(ops).toHaveLength(later);
    expect(ops.every((o) => o.op === 'set')).toBe(true);
    expect(alarmOps(steps, steps)).toEqual([]);
  });

  it('cancels alarms switched off or finished, and nothing else', () => {
    const steps = base();
    const fold = steps.find((s) => s.kind === 'fold')!;
    expect(alarmOps(steps, setAlarm(steps, fold.id, false))).toEqual([{ op: 'cancel', id: fold.id }]);
    const done = complete(steps, fold.id, fold.at);
    expect(alarmOps(steps, done)).toEqual([{ op: 'cancel', id: fold.id }]);
    expect(alarmOps(setAlarm(steps, fold.id, false), steps)).toEqual([
      { op: 'set', id: fold.id, at: fold.at, title: fold.title, ...(fold.note ? { note: fold.note } : {}) },
    ]);
  });

  it('rejects unknown steps', () => {
    expect(() => setAlarm(base(), 'nope', true)).toThrow();
  });
});
