import { daysSinceFed, setState, useStore } from '../store';

/** where the starter stands: asked once, then fed or put in the fridge from here (not on home) */
export function StarterCard() {
  const { starter } = useStore();
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
    <>
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
        </section>
      )}
    </>
  );
}
