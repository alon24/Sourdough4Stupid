import { Capacitor } from '@capacitor/core';
import { dayName, hhmm, until } from '../format';
import { planSummary } from '../summary';
import { complete, resumeAt, shift } from '../../../core/src/index';
import { useState } from 'preact/hooks';
import { type ActivePlan, allPlans, closePlan, planId, selectPlan, updatePlan, useStore } from '../store';

const isApk = Capacitor.isNativePlatform();
const CHECKED = 'machmetzet.alarms-checked';
const alarmsChecked = (): boolean => { try { return localStorage.getItem(CHECKED) === '1'; } catch { return true; } };

export function Home() {
  const st = useStore();
  const { history } = st;
  const nextAt = (p: ActivePlan) => p.steps.find((s) => s.doneAt === undefined)!.at;
  const running = allPlans(st).filter((p) => p.steps.some((s) => s.doneAt === undefined)).sort((a, b) => nextAt(a) - nextAt(b));
  /** the quick action that is open: a step picker or the cancel choices for one bake */
  const [promptGone, setPromptGone] = useState(false);
  const markChecked = () => { try { localStorage.setItem(CHECKED, '1'); } catch { /* ignore */ } setPromptGone(true); };
  const [quick, setQuick] = useState<{ id: string; kind: 'goto' | 'cancel' } | null>(null);
  const quickPlan = quick ? allPlans(st).find((p) => planId(p) === quick.id) : undefined;
  const act = (p: ActivePlan, fn: (steps: ActivePlan['steps']) => ActivePlan['steps']) => updatePlan(planId(p), (x) => ({ ...x, steps: fn(x.steps), undo: x.steps }));

  return (
    <main>
      <div class="row" style="align-items:flex-start">
        <div>
          <span class="muted">שלום!</span>
          <h1>המחמצת שלי</h1>
        </div>
        <span class="muted" data-testid="version" style="direction:ltr;font-size:12px;white-space:nowrap">v{__APP_VERSION__}{isApk ? ' · APK' : ''}</span>
      </div>

      {isApk && !alarmsChecked() && !promptGone && (
        <div class="card" data-testid="alarm-check-prompt">
          <strong>בדוק שהשעונים יצלצלו</strong>
          <span class="muted">פעם אחת: הרשאות והתראה לדוגמה בעוד 5 שניות.</span>
          <div class="grid2">
            <a class="btn small primary" href="#/more" onClick={() => markChecked()}>לבדוק עכשיו</a>
            <button class="btn small" onClick={() => markChecked()}>לא עכשיו</button>
          </div>
        </div>
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
          <span class="muted">כשתתחיל אפייה, כאן תראה מה השלב הבא ומתי. מתחילים ממתכון.</span>
        </section>
      )}

      <a class={`btn ${running.length === 0 ? 'primary' : ''}`} href="#/recipes" data-testid="to-recipes">📖 {running.length === 0 ? 'לבחור מתכון ולהתחיל' : 'המתכונים שלי'}</a>

      <a class="btn" href="#/care" data-testid="to-starter-care">🫙 יש לך סטארטר? פעולות</a>

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
