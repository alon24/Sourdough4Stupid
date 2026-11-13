import { Capacitor, registerPlugin } from '@capacitor/core';
import { alarmOps, complete, shift, type AlarmOp } from '../../core/src/index';
import { allPlans, alarmSteps, getState, planId, updatePlan } from './store';

interface AlarmEvent {
  id: string;
  action: 'snooze' | 'delay' | 'done';
  minutes: number;
  at: number;
}

interface AlarmsPlugin {
  apply(opts: { ops: AlarmOp[] }): Promise<void>;
  takeEvents(): Promise<{ events: AlarmEvent[] }>;
  status(): Promise<{ notifications: boolean; fullScreen: boolean }>;
  openSettings(opts: { what: 'notifications' | 'fullScreen' | 'battery' }): Promise<void>;
  test(): Promise<void>;
}

export const isNative = (): boolean => Capacitor.isNativePlatform();

export const Alarms = registerPlugin<AlarmsPlugin>('Alarms');

/** Apply what was pressed on the alarm screen (snooze, +30, done) to the bake it belongs to. */
export function applyEvents(events: AlarmEvent[]): void {
  for (const e of events) {
    const i = e.id.indexOf(':');
    const pid = i < 0 ? '' : e.id.slice(0, i);
    const sid = i < 0 ? e.id : e.id.slice(i + 1);
    const plan = allPlans(getState()).find((p) => (i < 0 ? true : planId(p) === pid) && p.steps.some((x) => x.id === sid));
    const step = plan?.steps.find((x) => x.id === sid);
    if (!plan || !step || step.doneAt !== undefined) continue;
    const steps =
      e.action === 'done'
        ? complete(plan.steps, sid, e.at)
        : shift(plan.steps, sid, (e.at + e.minutes * 60_000 - step.at) / 60_000, true);
    updatePlan(planId(plan), (p) => ({ ...p, steps, undo: p.steps }));
  }
}

async function pull(): Promise<void> {
  try {
    const { events } = await Alarms.takeEvents();
    if (events.length > 0) applyEvents(events);
  } catch {
    /* plugin not ready */
  }
}

/** Connect the plan to the phone's alarm clock. Does nothing in a normal browser. */
export function startNative(): void {
  if (!isNative()) return;
  window.SourdoughAlarms = { apply: (ops) => void Alarms.apply({ ops }).catch(() => undefined) };
  // heal anything the phone lost: send every alarm that is still due
  const all = alarmSteps(getState());
  const stale = allPlans(getState()).flatMap((p) => p.steps.map((x) => ({ op: 'cancel' as const, id: x.id }))); // alarms from before bakes had names
  const ops = [...stale, ...alarmOps([], all).filter((o) => o.op !== 'set' || o.at > Date.now())];
  if (ops.length > 0) window.SourdoughAlarms.apply(ops);
  void pull();
  setInterval(() => void pull(), 5_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void pull());
}
