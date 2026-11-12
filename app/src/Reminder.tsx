import { useEffect, useState } from 'preact/hooks';
import { complete, shift, type Step } from '../../core/src/index';
import { hhmm } from './format';
import { getState, setState, useStore } from './store';

/** In-app alarm while the app is open. Real Android alarms come with the native wrapper. */
export function Reminder() {
  const { plan } = useStore();
  const [now, setNow] = useState(Date.now());
  const [notified, setNotified] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const due: Step | undefined = plan?.steps.find((s) => s.doneAt === undefined && s.alarm && s.at <= now);
  useEffect(() => {
    if (!due || notified === due.id) return;
    setNotified(due.id);
    // Android Chrome refuses `new Notification()` ("Illegal constructor"): go through the service worker, and never let this throw
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const opts = { body: due.note?.split('\n')[0] ?? 'מחמצת לעד', tag: due.id };
        if (navigator.serviceWorker?.ready) void navigator.serviceWorker.ready.then((r) => r.showNotification(due.title, opts)).catch(() => undefined);
        else new Notification(due.title, opts);
      }
    } catch {
      /* the in-app toast below still shows */
    }
  }, [due?.id]);

  if (!plan || !due) return null;
  const update = (steps: Step[]) => setState({ plan: { ...getState().plan!, steps, undo: plan.steps } });
  return (
    <div class="toast" role="alert">
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
