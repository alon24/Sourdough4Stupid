import { useEffect, useState } from 'preact/hooks';
import { complete, shift, type Step } from '../../core/src/index';
import { hhmm } from './format';
import { allPlans, planId, updatePlan, useStore } from './store';

/** In-app alarm while the app is open. Real Android alarms come with the native wrapper. */
export function Reminder() {
  const st = useStore();
  const all = allPlans(st);
  const [now, setNow] = useState(Date.now());
  const [notified, setNotified] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const hit = all.map((p) => ({ p, s: p.steps.find((x) => x.doneAt === undefined && x.alarm && x.at <= now) })).find((h) => h.s);
  const plan = hit?.p;
  const due: Step | undefined = hit?.s;
  const named = (t: string) => (all.length > 1 && plan ? `${plan.title} · ${t}` : t);
  useEffect(() => {
    if (!due || notified === `${planId(plan!)}:${due.id}`) return;
    setNotified(`${planId(plan!)}:${due.id}`);
    // Android Chrome refuses `new Notification()` ("Illegal constructor"): go through the service worker, and never let this throw
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const opts = { body: due.note?.split('\n')[0] ?? 'מחמצת לעד', tag: `${planId(plan!)}:${due.id}` };
        if (navigator.serviceWorker?.ready) void navigator.serviceWorker.ready.then((r) => r.showNotification(named(due.title), opts)).catch(() => undefined);
        else new Notification(named(due.title), opts);
      }
    } catch {
      /* the in-app toast below still shows */
    }
  }, [due?.id, plan && planId(plan)]);

  if (!plan || !due) return null;
  const update = (steps: Step[]) => updatePlan(planId(plan), (p) => ({ ...p, steps, undo: p.steps }));
  return (
    <div class="toast" role="alert">
      {all.length > 1 && <span class="sub">{plan.title}</span>}
      <div class="row">
        <strong style="font-size:20px">{due.title}</strong>
        <span class="num">{hhmm(due.at)}</span>
      </div>
      {due.note && <span class="toast-note">{due.note}</span>}
      <div class="grid3">
        <button class="btn small" style="border-color:#fff;color:#fff" onClick={() => update(shift(plan.steps, due.id, Math.ceil((now - due.at) / 60_000) + 10))}>
          נודניק 10
        </button>
        <button class="btn small" style="border-color:#fff;color:#fff" onClick={() => update(shift(plan.steps, due.id, Math.ceil((now - due.at) / 60_000) + 30))}>
          <span class="num">+30</span>
        </button>
        <button class="btn small" style="background:#FFC93C;border-color:#FFC93C;color:#2B1D3A" onClick={() => update(complete(plan.steps, due.id, Date.now()))}>
          בוצע
        </button>
      </div>
    </div>
  );
}
