import { AlarmCheck } from './Alarms';
import { dayName, hhmm, until } from '../format';
import { daysSinceFed, setState, useStore } from '../store';

export function Home() {
  const { starter, plan } = useStore();
  const days = daysSinceFed(starter);
  const next = plan?.steps.find((s) => s.doneAt === undefined);
  const mood =
    days === 0 ? 'שבע ומרוצה' : days === 1 ? 'אכל אתמול' : `רעב כבר ${days} ימים`;
  const advice = !starter.inFridge
    ? 'בחוץ ופעיל.'
    : days > 30
      ? 'במקרר כבר הרבה זמן. צריך שתי האכלות חיזוק לפני אפייה.'
      : days > 14
        ? 'במקרר. האכלת חיזוק אחת לפני האפייה.'
        : 'במקרר. האכלה אחת והוא חוזר לעניינים.';

  return (
    <main>
      <div>
        <span class="muted">שלום!</span>
        <h1>מה אופים היום?</h1>
      </div>

      <section class="card sun" aria-label="הסטארטר שלי">
        <span class="sub">{starter.name}</span>
        <span class="big">{mood}</span>
        <span>{advice}</span>
        <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
          <button class="btn primary small" onClick={() => setState({ starter: { ...starter, lastFedAt: Date.now(), inFridge: false } })}>
            האכלתי עכשיו
          </button>
          <button class="btn small" style="border-color:#2B1D3A;color:#2B1D3A" onClick={() => setState({ starter: { ...starter, inFridge: !starter.inFridge } })}>
            {starter.inFridge ? 'הוצאתי מהמקרר' : 'הכנסתי למקרר'}
          </button>
        </div>
        <a class="btn small" href="#/starter" style="color:#2B1D3A;border-color:#2B1D3A">מה מצב הסטארטר? (שאלון קצר)</a>
      </section>

      {next && plan ? (
        <a class="card" href="#/plan" style="text-decoration:none;color:inherit" aria-label="השלב הבא">
          <div class="row">
            <span class="sub">השלב הבא · {plan.title}</span>
            <span class="tag">{until(next.at)}</span>
          </div>
          <div class="row">
            <span class="big">{next.title}</span>
            <span class="big num">{hhmm(next.at)}</span>
          </div>
          <span class="muted">{dayName(next.at)}</span>
        </a>
      ) : (
        <section class="card">
          <span class="big">אין אפייה בתנור</span>
          <span class="muted">בוחרים כמה לחמים ומתי, והתוכנית מסתדרת לבד.</span>
        </section>
      )}

      <AlarmCheck />
      <span class="muted" data-testid="version" style="direction:ltr;text-align:left;font-size:12px">v{__APP_VERSION__}</span>

      <div class="grid2">
        <a class="btn primary" href="#/new" style="display:flex;align-items:center;justify-content:center;text-decoration:none">אפייה חדשה</a>
        <a class="btn" href="#/recipes" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:inherit">מתכונים</a>
      </div>
      <a href="#/help" style="text-align:center;color:inherit;font-weight:700">עזרה ומדריך</a>
      <a href="#/app" style="text-align:center;color:inherit;font-weight:700">הורדת אפליקציית אנדרואיד</a>
    </main>
  );
}
