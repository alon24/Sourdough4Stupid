import { Capacitor, registerPlugin } from '@capacitor/core';
import { alarmOps, complete, shift, type AlarmOp } from '../../core/src/index';
import { getState, setState } from './store';

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

/** Apply what was pressed on the alarm screen (snooze, +30, done) to the plan. */
export function applyEvents(events: AlarmEvent[]): void {
  for (const e of events) {
    const plan = getState().plan;
    const step = plan?.steps.find((s) => s.id === e.id);
    if (!plan || !step || step.doneAt !== undefined) continue;
    const steps =
      e.action === 'done'
        ? complete(plan.steps, e.id, e.at)
        : shift(plan.steps, e.id, (e.at + e.minutes * 60_000 - step.at) / 60_000, true);
    setState({ plan: { ...plan, steps, undo: plan.steps } });
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
  const plan = getState().plan;
  if (plan) {
    const ops = alarmOps([], plan.steps).filter((o) => o.op !== 'set' || o.at > Date.now());
    if (ops.length > 0) window.SourdoughAlarms.apply(ops);
  }
  void pull();
  setInterval(() => void pull(), 5_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void pull());
}
