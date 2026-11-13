import { Capacitor } from '@capacitor/core';
import { AlarmCheck } from './Alarms';
import { dayName, hhmm, until } from '../format';
import { allPlans, daysSinceFed, planId, selectPlan, setState, useStore } from '../store';

const isApk = Capacitor.isNativePlatform();

export function Home() {
  const st = useStore();
  const { starter, history } = st;
  const running = allPlans(st).filter((p) => p.steps.some((s) => s.doneAt === undefined));
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

      {running.length > 0 ? (
        <section style="display:flex;flex-direction:column;gap:10px" aria-label="אפיות רצות" data-testid="running-list">
          {running.map((plan) => {
            const next = plan.steps.find((s) => s.doneAt === undefined)!;
            const done = plan.steps.filter((x) => x.doneAt !== undefined).length;
            return (
              <a class="card sun running" href="#/plan" onClick={() => selectPlan(planId(plan))} style="text-decoration:none;color:inherit" aria-label={`אפייה רצה: ${plan.title}`} data-testid="running">
                <div class="row">
                  <span class="sub">▶ {running.length > 1 ? 'אפייה' : 'תוכנית'} רצה עכשיו · {plan.title}</span>
                  <span class="tag">{until(next.at)}</span>
                </div>
                <span class="muted">השלב הבא</span>
                <div class="row">
                  <span class="big">{next.title}</span>
                  <span class="big num">{hhmm(next.at)}</span>
                </div>
                <span class="muted">{dayName(next.at)} · שלב {done + 1} מתוך {plan.steps.length}. לחיצה פותחת את כל התוכנית.</span>
              </a>
            );
          })}
        </section>
      ) : (
        <section class="card" data-testid="idle">
          <span class="big">אין תוכנית רצה</span>
          <span class="muted">כשתתחיל אפייה, כאן תראה מה השלב הבא ומתי.</span>
        </section>
      )}

      <div class="grid2">
        <a class="btn" href="#/recipes">📖 מתכונים</a>
        <a class="btn primary" href="#/new">🍞 להתחיל אפייה</a>
      </div>
      <span class="muted" style="text-align:center;font-size:13px">מתכונים: התבניות השמורות שלך. להתחיל אפייה: בוחרים מה אופים ומתי, והתוכנית מסתדרת.</span>

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
        <section class="card" aria-label="מה אפיתי לאחרונה" data-testid="recent">
          <strong>מה אפיתי לאחרונה</strong>
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
        </section>
      )}

      <AlarmCheck />

      <a href="#/help" style="text-align:center;color:inherit;font-weight:700">עזרה ומדריך</a>
      <a href="#/app" style="text-align:center;color:inherit;font-weight:700">הורדת אפליקציית אנדרואיד</a>
      <a href="#/sync" style="text-align:center;color:inherit;font-weight:700">סנכרון עם Google Drive</a>
    </main>
  );
}
