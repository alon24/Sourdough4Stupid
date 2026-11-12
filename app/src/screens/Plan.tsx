import { useState } from 'preact/hooks';
import {
  addFold, removeFold, bulkState, complete, doughTempAdvice, FRICTION, resumeAt, retimeBulk, roomTempTip, setAlarm, shift, TARGET_DOUGH_C,
  waterTemp, type Reading, type Step,
} from '../../../core/src/index';
import { dayName, grams, hhmm, toLocalInput, until } from '../format';
import { getState, setState, useStore } from '../store';

export function PlanScreen() {
  const { plan, history } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [cascade, setCascade] = useState(true);
  const [doneAtInput, setDoneAtInput] = useState('');

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

      {plan.input && !steps.some((s) => s.doneAt !== undefined) && (
        <a class="btn primary" href="#/start" style="display:flex;justify-content:center;text-decoration:none">התחלת ביצוע: איפה אני?</a>
      )}

      {plan.bulk && <TempCard />}

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
            {sel.kind === 'fold' && sel.doneAt === undefined && (
              <div class="grid2">
                <button class="btn small" onClick={() => update(addFold(steps, plan.input?.foldGapMin ?? 30))}>הוסף קיפול</button>
                <button class="btn small" onClick={() => update(removeFold(steps, sel.id))}>הסר קיפול זה</button>
              </div>
            )}
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
                <label class="field">
                  בוצע בשעה (אם כבר עשית)
                  <input
                    type="time"
                    value={doneAtInput}
                    onInput={(e) => setDoneAtInput(e.currentTarget.value)}
                  />
                </label>
                {doneAtInput && (
                  <button class="btn small" onClick={() => {
                    const [h, m] = doneAtInput.split(':').map(Number);
                    const d = new Date(sel.at);
                    d.setHours(h ?? 0, m ?? 0, 0, 0);
                    // a time earlier than the step belongs to the same day; a late-night step may roll over
                    if (d.getTime() < sel.at - 12 * 3_600_000) d.setDate(d.getDate() + 1);
                    setDoneAtInput('');
                    update(complete(steps, sel.id, d.getTime()));
                  }}>
                    סמן שבוצע ב־<span class="num">{doneAtInput}</span>
                  </button>
                )}
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

/** Quick temperature input: dough, kitchen, rise. Recomputes the rest of the bulk and the alarms. */
function TempCard() {
  const { plan, roomTempC } = useStore();
  const [dough, setDough] = useState('');
  const [room, setRoom] = useState(String(roomTempC));
  const [rise, setRise] = useState('');
  if (!plan?.bulk) return null;
  const bulk = plan.bulk;
  const readings: Reading[] = plan.readings ?? [];
  const now = Date.now();
  const started = now >= bulk.startAt;
  const st = bulkState(readings, now, bulk);
  const lastDough = [...readings].reverse().find((r) => r.doughC !== undefined)?.doughC;
  const roomNum = Number(room) || roomTempC;
  const water = waterTemp({
    desired: TARGET_DOUGH_C.bread, flour: roomNum, room: roomNum, levain: roomNum,
    friction: FRICTION[plan.kneading ?? 'hand'],
  });
  const left = Math.round(st.remainingMin);

  const apply = () => {
    const r: Reading = { at: Date.now() };
    if (dough !== '' && !Number.isNaN(Number(dough))) r.doughC = Number(dough);
    if (room !== '' && !Number.isNaN(Number(room))) r.roomC = Number(room);
    if (rise !== '' && !Number.isNaN(Number(rise))) r.risePct = Number(rise);
    const next = [...readings, r];
    const steps = retimeBulk(plan.steps, bulk, next, r.at);
    setState({ plan: { ...getState().plan!, readings: next, steps, undo: steps === plan.steps ? plan.undo : plan.steps } });
    setDough('');
    setRise('');
  };

  return (
    <section class="card" aria-label="טמפרטורות">
      <strong>טמפרטורות</strong>
      {!started && (
        <span class="muted" data-testid="water-tip">
          לבצק בטמפרטורת <span class="num">{TARGET_DOUGH_C.bread}°</span> השתמש במים בכ־<span class="num">{Math.round(water)}°</span>
          {plan.kneading === 'machine' ? ' (מכונה מחממת את הבצק)' : ''}.
        </span>
      )}
      {started && (
        <>
          <div class="row">
            <span>
              {left === 0 ? 'ההתפחה אמורה להסתיים, בדוק את הבצק' : <>נשארו בערך <span class="num" data-testid="bulk-left">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span> ש' להתפחה</>}
            </span>
            <span class="tag">{Math.round(st.progress * 100)}%</span>
          </div>
          <progress max={100} value={Math.round(st.progress * 100)} aria-label="התקדמות ההתפחה" style="width:100%"></progress>
        </>
      )}
      <div class="grid3">
        <label class="field">
          בצק °C
          <input type="number" inputMode="decimal" value={dough} placeholder="26" onInput={(e) => setDough(e.currentTarget.value)} />
        </label>
        <label class="field">
          מטבח °C
          <input type="number" inputMode="decimal" value={room} onInput={(e) => setRoom(e.currentTarget.value)} />
        </label>
        <label class="field">
          עלייה %
          <input type="number" inputMode="decimal" value={rise} placeholder="40" onInput={(e) => setRise(e.currentTarget.value)} />
        </label>
      </div>
      <button class="btn small" onClick={apply}>עדכן את הזמנים</button>
      {lastDough !== undefined && <span data-testid="dough-advice">{doughTempAdvice(lastDough).text}</span>}
      <span class="muted">{roomTempTip(roomNum)}</span>
    </section>
  );
}
