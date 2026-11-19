import { useState } from 'preact/hooks';
import { starterPlan, type Step } from '../../../core/src/index';
import { dayName, hhmm } from '../format';
import { addPlan, daysSinceFed, useStore } from '../store';

const HOUR = 3_600_000;
type T = 'stiff' | 'liquid';
/** no exact clock times: start now, start tomorrow morning, or be ready around tomorrow morning */
type When = 'now' | 'tomorrow' | 'readyTomorrow';
const morning = (h: number, now: number): number => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d.getTime(); };
const H: Record<T, number> = { stiff: 0.5, liquid: 1 };

function Seg({ value, set, label }: { value: T; set: (t: T) => void; label: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      <button class={value === 'stiff' ? 'on' : ''} aria-pressed={value === 'stiff'} onClick={() => set('stiff')}>קשה (50%)</button>
      <button class={value === 'liquid' ? 'on' : ''} aria-pressed={value === 'liquid'} onClick={() => set('liquid')}>נוזלי (100%)</button>
    </div>
  );
}

/** All starter care in one place: grow it, switch stiff <-> liquid, and be ready at a chosen time. Usable without a bake. */
export function StarterCare() {
  const { starter, roomTempC } = useStore();
  const now = Date.now();
  const [have, setHave] = useState(starter.grams ?? 30);
  const [from, setFrom] = useState<T>(starter.type);
  const [to, setTo] = useState<T>('liquid');
  const [target, setTarget] = useState(300);
  const [fridge, setFridge] = useState(starter.inFridge);
  const [days, setDays] = useState(starter.known ? daysSinceFed(starter) : 7);
  const [when, setWhen] = useState<When>('now');
  const [temp, setTemp] = useState(roomTempC);
  const [started, setStarted] = useState(false);

  const valid = have > 0 && target > 0;
  const timing = when === 'tomorrow' ? { startAt: morning(8, now) } : when === 'readyTomorrow' ? { readyAt: morning(9, now) } : { startAt: now };
  const p = valid ? starterPlan({ have, fromType: from, fromHydration: H[from], target, toType: to, toHydration: H[to], ...timing, now, daysInFridge: fridge ? days : undefined, tempC: temp }) : null;

  const start = () => {
    if (!p) return;
    const t0 = Date.now();
    const steps: Step[] = p.steps.map((s, i) => ({ id: `s${i}`, kind: s.kind === 'ready' ? 'custom' : s.kind === 'revive' ? 'revive' : 'feed', title: s.title, at: s.at, alarm: true, note: s.note }));
    addPlan({
      title: `סטארטר ${to === 'stiff' ? 'קשה' : 'נוזלי'} ${target} ג'`,
      createdAt: t0,
      steps,
      amounts: [],
      build: p.steps.filter((s) => s.amounts).map((s) => s.note.split('.')[0]).join(' · '),
    });
    setStarted(true);
  };

  return (
    <main>
      <div>
        <span class="sub">הסטארטר</span>
        <h1>טיפול בסטארטר</h1>
      </div>
      <span class="muted">בלי קשר לאפייה: להגדיל, להפוך קשה לנוזלי (או להפך) ולהגיע לכמות שרוצים בזמן שרוצים. כל שלב הופך לשעון.</span>

      <section class="card">
        <strong>מה יש לי</strong>
        <Seg value={from} set={setFrom} label="סוג הסטארטר שיש לי" />
        <label class="field">כמה יש (גרם)<input type="number" inputMode="numeric" min="1" value={have} onInput={(e) => setHave(+e.currentTarget.value)} /></label>
        <div class="seg" role="group" aria-label="איפה הוא">
          <button class={fridge ? 'on' : ''} aria-pressed={fridge} onClick={() => setFridge(true)}>במקרר</button>
          <button class={!fridge ? 'on' : ''} aria-pressed={!fridge} onClick={() => setFridge(false)}>בחוץ, פעיל</button>
        </div>
        {fridge && <label class="field">כמה ימים במקרר<input type="number" inputMode="numeric" min="0" max="365" value={days} onInput={(e) => setDays(+e.currentTarget.value)} /></label>}
      </section>

      <section class="card">
        <strong>מה אני רוצה</strong>
        <Seg value={to} set={setTo} label="סוג הסטארטר שאני רוצה" />
        <div class="grid3">
          <label class="field">כמה (גרם)<input type="number" inputMode="numeric" min="1" value={target} onInput={(e) => setTarget(+e.currentTarget.value)} /></label>
          <label class="field">טמפ' חדר<input type="number" inputMode="numeric" min="10" max="35" value={temp} onInput={(e) => setTemp(+e.currentTarget.value)} /></label>
        </div>
        <strong>מתי?</strong>
        <div class="chips" role="group" aria-label="מתי">
          <button class={`chip ${when === 'now' ? 'on' : ''}`} aria-pressed={when === 'now'} onClick={() => setWhen('now')}>להתחיל עכשיו</button>
          <button class={`chip ${when === 'tomorrow' ? 'on' : ''}`} aria-pressed={when === 'tomorrow'} onClick={() => setWhen('tomorrow')}>להתחיל מחר בבוקר</button>
          <button class={`chip ${when === 'readyTomorrow' ? 'on' : ''}`} aria-pressed={when === 'readyTomorrow'} onClick={() => setWhen('readyTomorrow')}>שיהיה מוכן מחר בערך</button>
        </div>
      </section>

      {p && (
        <section class="card sun" aria-label="התוכנית" data-testid="care-plan">
          <strong>התוכנית</strong>
          {p.problem === 'conversion' && <span role="alert">אי אפשר להגיע להידרציה הזאת בהאכלה אחת מהכמות שיש. כדאי להתחיל מיותר סטארטר.</span>}
          {p.problem === 'tooMuch' && <span role="alert">אין מספיק סטארטר להגיע לכמות הזאת במספר סביר של האכלות. כדאי להקטין את הכמות.</span>}
          {p.late && <span role="alert">לא מספיקים עד מחר. הכי מוקדם: {dayName(p.readyAt)} {hhmm(p.readyAt)}.</span>}
          <ol style="padding-inline-start:20px;margin:0;display:flex;flex-direction:column;gap:8px">
            {p.steps.map((s) => (
              <li data-testid="care-step">
                <span class="num">{dayName(s.at)} {hhmm(s.at)}</span> · <strong>{s.title}</strong>
                <div class="muted">{s.note}</div>
              </li>
            ))}
          </ol>
          {started
            ? <a class="btn primary" href="#/plan">התוכנית רצה, לשעונים ←</a>
            : <button class="btn primary" onClick={start} disabled={!!p.problem}>התחל: שעון לכל שלב</button>}
        </section>
      )}
      <a class="btn small" href="#/starter">עדכון מצב הסטארטר שלי</a>
      <a class="btn small" href="#/calc">מחשבון מהיר: כמה להאכיל?</a>
    </main>
  );
}
