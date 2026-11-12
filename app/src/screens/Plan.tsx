import { useState } from 'preact/hooks';
import { complete, resumeAt, setAlarm, shift, type Step } from '../../../core/src/index';
import { dayName, grams, hhmm, until } from '../format';
import { getState, setState, useStore } from '../store';

export function PlanScreen() {
  const { plan, history } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [cascade, setCascade] = useState(true);

  if (!plan) {
    return (
      <main>
        <h1>אין תוכנית פעילה</h1>
        <p class="muted">מתחילים אפייה חדשה, והשלבים יופיעו כאן עם שעות.</p>
        <a class="btn primary" href="#/new" style="display:flex;align-items:center;justify-content:center;text-decoration:none">אפייה חדשה</a>
      </main>
    );
  }

  const steps = plan.steps;
  const next = steps.find((s) => s.doneAt === undefined);
  const last = steps[steps.length - 1]!;
  const sel = steps.find((s) => s.id === open);
  const update = (s: Step[]) => {
    setState({ plan: { ...getState().plan!, steps: s, undo: steps } });
    setOpen(null);
  };
  const finish = () => setState({ plan: null, history: [{ title: plan.title, finishedAt: Date.now() }, ...history] });
  const askNotify = () => 'Notification' in window && Notification.requestPermission();

  let prevDay = '';
  return (
    <main>
      <div>
        <span class="sub">{plan.title}</span>
        <h1>התוכנית שלך</h1>
      </div>

      <section class="card mint">
        <div class="row">
          <strong>
            מסיימים {dayName(last.at)} ב־<span class="num" data-testid="finish">{hhmm(last.at)}</span>
          </strong>
          {plan.undo && (
            <button class="btn small" onClick={() => setState({ plan: { ...plan, steps: plan.undo!, undo: undefined } })}>בטל שינוי</button>
          )}
        </div>
      </section>

      <details class="card">
        <summary style="font-weight:700;cursor:pointer;min-height:32px">כמויות</summary>
        <table class="amounts">
          <tbody>
            {plan.amounts.map((a) => (
              <tr><td>{a.name}</td><td>{grams(a.grams)}</td></tr>
            ))}
          </tbody>
        </table>
        <span class="muted">האכלת הסטארטר: {plan.build}</span>
      </details>

      <div class="steps">
        {steps.map((s) => {
          const day = dayName(s.at);
          const header = day !== prevDay;
          prevDay = day;
          const cls = s.doneAt !== undefined ? 'done' : s.id === next?.id ? 'next' : '';
          return (
            <>
              {header && <span class="sub day">{day}</span>}
              <button class={`step ${cls}`} onClick={() => setOpen(s.id)} aria-label={`${s.title}, ${hhmm(s.at)}`}>
                <span class="t num">{hhmm(s.at)}</span>
                <span class="dot" aria-hidden="true"></span>
                <span>
                  <span class="title">{s.title}{s.alarm && s.doneAt === undefined ? ' ⏰' : ''}</span>
                  {s.id === next?.id && <span class="note">{until(s.at)}</span>}
                  {s.note && s.doneAt === undefined && <span class="note">{s.note}</span>}
                </span>
              </button>
            </>
          );
        })}
      </div>

      <div class="grid2">
        <button class="btn small" onClick={askNotify}>הפעל התראות</button>
        <button class="btn small" onClick={finish}>{next ? 'בטל תוכנית' : 'סיימתי, לשמור ביומן'}</button>
      </div>

      {sel && (
        <>
          <button class="scrim" aria-label="סגור" onClick={() => setOpen(null)}></button>
          <div class="sheet" role="dialog" aria-label={sel.title}>
            <div class="row">
              <strong class="big">{sel.title}</strong>
              <span class="big num">{hhmm(sel.at)}</span>
            </div>
            {sel.note && <span class="muted">{sel.note}</span>}
            {sel.doneAt === undefined ? (
              <>
                <div class="grid3">
                  {[-15, 15, 30, 60].slice(0, 3).map((m) => (
                    <button class="btn small" onClick={() => update(shift(steps, sel.id, m, cascade))}>
                      <span class="num">{m > 0 ? `+${m}` : m}</span> דק'
                    </button>
                  ))}
                </div>
                <label class="row" style="justify-content:flex-start;min-height:48px">
                  <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.currentTarget.checked)} style="width:24px;height:24px" />
                  להזיז גם את כל השלבים שאחריו
                </label>
                <label class="row" style="justify-content:flex-start;min-height:48px">
                  <input type="checkbox" checked={sel.alarm} onChange={(e) => update(setAlarm(steps, sel.id, e.currentTarget.checked))} style="width:24px;height:24px" />
                  שעון מעורר לשלב הזה
                </label>
                <div class="grid2">
                  <button class="btn" onClick={() => update(resumeAt(steps, sel.id, Date.now()))}>אני כאן עכשיו</button>
                  <button class="btn primary" onClick={() => update(complete(steps, sel.id, Date.now()))}>בוצע</button>
                </div>
              </>
            ) : (
              <span class="muted">בוצע ב־<span class="num">{hhmm(sel.doneAt)}</span></span>
            )}
          </div>
        </>
      )}
    </main>
  );
}
