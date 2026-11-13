import { Capacitor } from '@capacitor/core';
import { dayName, hhmm, until } from '../format';
import { planSummary } from '../summary';
import { complete, resumeAt, shift } from '../../../core/src/index';
import { useState } from 'preact/hooks';
import { type ActivePlan, allPlans, closePlan, daysSinceFed, planId, selectPlan, setState, updatePlan, useStore } from '../store';

const isApk = Capacitor.isNativePlatform();
const CHECKED = 'machmetzet.alarms-checked';
const alarmsChecked = (): boolean => { try { return localStorage.getItem(CHECKED) === '1'; } catch { return true; } };

export function Home() {
  const st = useStore();
  const { starter, history } = st;
  const nextAt = (p: ActivePlan) => p.steps.find((s) => s.doneAt === undefined)!.at;
  const running = allPlans(st).filter((p) => p.steps.some((s) => s.doneAt === undefined)).sort((a, b) => nextAt(a) - nextAt(b));
  const days = daysSinceFed(starter);
  const known = starter.known === true;
  const mood = days === 0 ? 'הואכל היום' : days === 1 ? 'הואכל אתמול' : `הואכל לפני ${days} ימים`;
  const advice = !starter.inFridge
    ? 'בחוץ ופעיל.'
    : days > 30
      ? 'במקרר כבר הרבה זמן. צריך שתי האכלות חיזוק לפני אפייה.'
      : days > 14
        ? 'במקרר. האכלת חיזוק אחת לפני האפייה.'
        : 'במקרר. האכלה אחת והוא חוזר לעניינים.';
  /** the quick action that is open: a step picker or the cancel choices for one bake */
  const [quick, setQuick] = useState<{ id: string; kind: 'goto' | 'cancel' } | null>(null);
  const quickPlan = quick ? allPlans(st).find((p) => planId(p) === quick.id) : undefined;
  const act = (p: ActivePlan, fn: (steps: ActivePlan['steps']) => ActivePlan['steps']) => updatePlan(planId(p), (x) => ({ ...x, steps: fn(x.steps), undo: x.steps }));
  const markFed = (p: object) => setState({ starter: { ...starter, known: true, none: false, ...p } });

  return (
    <main>
      <div class="row" style="align-items:flex-start">
        <div>
          <span class="muted">שלום!</span>
          <h1>מה אופים היום?</h1>
        </div>
        <span class="muted" data-testid="version" style="direction:ltr;font-size:12px;white-space:nowrap">v{__APP_VERSION__}{isApk ? ' · APK' : ''}</span>
      </div>

      {isApk && !alarmsChecked() && (
        <a class="card" href="#/more" onClick={() => { try { localStorage.setItem(CHECKED, '1'); } catch { /* ignore */ } }} data-testid="alarm-check-prompt" style="text-decoration:none;color:inherit">
          <strong>בדוק שהשעונים יצלצלו</strong>
          <span class="muted">פעם אחת: הרשאות והתראה לדוגמה בעוד 5 שניות. לחיצה פותחת את הבדיקה.</span>
        </a>
      )}

      {running.length > 0 ? (
        <section style="display:flex;flex-direction:column;gap:10px" aria-label="אפיות רצות" data-testid="running-list">
          {running.length > 1 && <strong>אפיות רצות ({running.length})</strong>}
          {running.map((plan) => {
            const next = plan.steps.find((s) => s.doneAt === undefined)!;
            const done = plan.steps.filter((x) => x.doneAt !== undefined).length;
            const waiting = next.at - Date.now() > 12 * 3_600_000;
            return (
              <div class={`card ${waiting ? 'pending' : 'sun'} running`} data-testid="running">
              <a href="#/plan" onClick={() => selectPlan(planId(plan))} style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px" aria-label={`אפייה רצה: ${plan.title}`}>
                <div class="row">
                  <span class="sub">{waiting ? '⏳ ממתינה לשלב הראשון' : '▶ רצה עכשיו'} · {plan.title}</span>
                  <span class="tag">{until(next.at)}</span>
                </div>
                <span class="muted">השלב הבא</span>
                <div class="row">
                  <span class="big">{next.title}</span>
                  <span class="big num">{hhmm(next.at)}</span>
                </div>
                <span class="muted" data-testid="plan-summary">{planSummary(plan)}</span>
                <span class="muted">{dayName(next.at)} · שלב {done + 1} מתוך {plan.steps.length}</span>
              </a>
              <div class="quick" role="group" aria-label={`פעולות מהירות: ${plan.title}`}>
                <button class="btn small primary" aria-label={`סמן כבוצע (${plan.title})`} onClick={() => act(plan, (steps) => complete(steps, next.id, Date.now()))}>✓ בוצע</button>
                <button class="btn small" aria-label={`דחה ב־30 דקות (${plan.title})`} onClick={() => act(plan, (steps) => shift(steps, next.id, Math.max(30, Math.ceil((Date.now() - next.at) / 60_000) + 30)))}>+30 דק'</button>
                <button class="btn small" aria-label={`עבור לשלב (${plan.title})`} onClick={() => setQuick({ id: planId(plan), kind: 'goto' })}>⏭ לשלב</button>
                <button class="btn small danger" aria-label={`בטל אפייה (${plan.title})`} onClick={() => setQuick({ id: planId(plan), kind: 'cancel' })}>בטל</button>
              </div>
            </div>
            );
          })}
        </section>
      ) : (
        <section class="card" data-testid="idle">
          <span class="big">אין אפייה רצה</span>
          <span class="muted">כשתתחיל אפייה, כאן תראה מה השלב הבא ומתי.</span>
        </section>
      )}

      <div class="grid2">
        <a class="btn" href="#/recipes">📖 מתכונים</a>
        <a class="btn primary" href="#/new">🍞 להתחיל אפייה</a>
      </div>

      {!known && !starter.none ? (
        <section class="card sun" aria-label="הסטארטר שלי" data-testid="starter-ask">
          <span class="sub">הסטארטר</span>
          <span class="big">יש לך סטארטר?</span>
          <span>כמה שאלות קצרות: איפה הוא, מתי האכלת, ובאיזה מצב. משם האפליקציה מחשבת הכול.</span>
          <a class="btn primary small" href="#/starter">כן, בוא נגדיר</a>
          <button class="btn small" style="border-color:#2B1D3A;color:#2B1D3A" onClick={() => setState({ starter: { ...starter, none: true } })}>אין לי עדיין</button>
        </section>
      ) : starter.none ? (
        <section class="card" aria-label="הסטארטר שלי">
          <span class="sub">הסטארטר</span>
          <span class="big">אין סטארטר עדיין</span>
          <span class="muted">אפשר להכין אחד מקמח ומים בכמה ימים. כשיש, מגדירים אותו כאן.</span>
          <a class="btn small" href="#/starter">יש לי סטארטר עכשיו</a>
          <a class="btn small" href="#/new" data-testid="starter-next">לתכנן אפייה בלי סטארטר מוכן</a>
        </section>
      ) : (
        <section class="card sun" aria-label="הסטארטר שלי">
          <span class="sub">{starter.name}</span>
          <span class="big">{mood}</span>
          <span>{advice}</span>
          <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
            <button class="btn primary small" onClick={() => markFed({ lastFedAt: Date.now(), inFridge: false })}>
              האכלתי עכשיו
            </button>
            <button class="btn small" style="border-color:#2B1D3A;color:#2B1D3A" onClick={() => markFed({ inFridge: !starter.inFridge })}>
              {starter.inFridge ? 'הוצאתי מהמקרר' : 'הכנסתי למקרר'}
            </button>
          </div>
          <a class="btn small" href="#/starter" style="color:#2B1D3A;border-color:#2B1D3A">עדכון מצב הסטארטר</a>
          <a class="btn small" href="#/new" style="color:#2B1D3A;border-color:#2B1D3A" data-testid="starter-next">יש סטארטר: להתחיל אפייה</a>
        </section>
      )}

      {history.length > 0 && (
        <section class="card" aria-label="יומן אפיות" data-testid="recent">
          <strong>יומן אפיות: האחרונות</strong>
          {history.slice(0, 3).map((h) => (
            <div class="row" data-testid="recent-item">
              <span>{h.title}</span>
              <span class="muted">
                {new Date(h.finishedAt).toLocaleDateString('he-IL')}
                {h.notes?.length ? ` · ${h.notes.length} הערות` : ''}
                {h.photos?.length ? ` · ${h.photos.length} תמונות` : ''}
              </span>
            </div>
          ))}
          <a class="btn small" href="#/log">כל היומן</a>
        </section>
      )}

      {quick && quickPlan && (
        <>
          <button class="scrim" aria-label="סגור" onClick={() => setQuick(null)}></button>
          <div class="sheet" role="dialog" aria-label={quick.kind === 'goto' ? 'מעבר לשלב' : 'ביטול אפייה'}>
            {quick.kind === 'goto' ? (
              <>
                <strong class="big">באיזה שלב אתה? · {quickPlan.title}</strong>
                <div class="goto-list">
                  {quickPlan.steps.filter((x) => x.doneAt === undefined).map((x) => (
                    <button class="chip" onClick={() => { act(quickPlan, (steps) => resumeAt(steps, x.id, Date.now())); setQuick(null); }}>
                      {x.title} <span class="muted num">{hhmm(x.at)}</span>
                    </button>
                  ))}
                </div>
                <button class="btn small" onClick={() => setQuick(null)}>סגור</button>
              </>
            ) : (
              <>
                <strong class="big">לבטל את "{quickPlan.title}"?</strong>
                <span class="muted">השעונים של האפייה הזאת יימחקו. אפשר לשמור אותה ביומן כ"לא הושלמה".</span>
                <button class="btn primary" onClick={() => { closePlan(quick.id, 'unfinished'); setQuick(null); }}>בטל ושמור ביומן</button>
                <button class="btn danger" onClick={() => { closePlan(quick.id, null); setQuick(null); }}>בטל בלי לשמור</button>
                <button class="btn small" onClick={() => setQuick(null)}>חזרה</button>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
