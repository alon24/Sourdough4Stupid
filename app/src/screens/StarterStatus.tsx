import { useState } from 'preact/hooks';
import { revivalFeeds } from '../../../core/src/index';
import { setState, useStore } from '../store';

const DAY = 86_400_000;
const HOUR = 3_600_000;
type Where = 'fridge' | 'room';
type Cond = 'active' | 'weak' | 'unknown';

function Q({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section class="card">
      <h2 style="margin:0">{title}</h2>
      <div class="chips">{children}</div>
    </section>
  );
}

/** A typed number with its unit; reports null when empty or out of range. */
function Num({ label, unit, value, min, max, onValue, aria }: { label: string; unit: string; value: string; min: number; max: number; onValue: (v: number | null, raw: string) => void; aria: string }) {
  const n = parseFloat(value);
  const bad = value !== '' && !(Number.isFinite(n) && n >= min && n <= max);
  return (
    <label class="field" style="flex-direction:row;align-items:center;gap:6px;flex-wrap:wrap">
      {label}
      <input type="number" inputMode="decimal" min={min} max={max} aria-label={aria} aria-invalid={bad} style={`width:84px;${bad ? 'border-color:var(--coral)' : ''}`} value={value}
        onInput={(e) => { const t = e.currentTarget.value; const x = parseFloat(t); onValue(Number.isFinite(x) && x >= min && x <= max ? x : null, t); }} />
      {unit}
      {bad && <span class="muted" role="alert">בין {min} ל־{max}</span>}
    </label>
  );
}

function Chip<T>({ v, cur, set, children }: { v: T; cur: T | null; set: (v: T) => void; children: preact.ComponentChildren }) {
  return <button class={`chip ${cur === v ? 'on' : ''}`} aria-pressed={cur === v} onClick={() => set(v)}>{children}</button>;
}

/** "How is your starter?": one tap per question, then what to do next. */
export function StarterStatus() {
  const { starter } = useStore();
  /** hydration in percent: chips for 50 and 100, or any number you type */
  const [hyd, setHyd] = useState<number | null>(null);
  const type: 'stiff' | 'liquid' | null = hyd === null ? null : hyd <= 70 ? 'stiff' : 'liquid';
  const [hydN, setHydN] = useState('');
  const [fridgeN, setFridgeN] = useState('');
  const [unit, setUnit] = useState<1 | 7>(1);
  const [hoursN, setHoursN] = useState('');
  const [gramsN, setGramsN] = useState('');
  const [where, setWhere] = useState<Where | null>(null);
  const [days, setDays] = useState<number | null>(null); // fridge: days in it; room: hours since feeding
  const [cond, setCond] = useState<Cond | null>(null);
  const [grams, setGrams] = useState<number | null>(null);

  const timeDone = days !== null;
  const done = type && where && timeDone && (where === 'fridge' || cond) && grams !== null;

  let advice = '';
  if (done) {
    const d = where === 'fridge' ? days! : 0;
    const feeds = where === 'fridge' ? revivalFeeds(d) : cond === 'weak' ? 2 : 0;
    advice =
      cond === 'weak' && where === 'room'
        ? 'חלש: שתי האכלות חיזוק, כל אחת כשהקודמת הכפילה את עצמה, ורק אז לבנות.'
        : where === 'fridge'
          ? feeds === 0
            ? 'במקרר, אבל עדיין חזק: האכלה אחת והוא מוכן לבנייה.'
            : `במקרר הרבה זמן: ${feeds === 1 ? 'האכלת חיזוק אחת' : 'שתי האכלות חיזוק'} לפני הבנייה.`
          : cond === 'active'
            ? days! > 12 ? 'פעיל אבל עבר זמן מההאכלה: האכל שוב לפני הבנייה.' : 'פעיל ובמצב טוב: אפשר לבנות ממנו ישר.'
            : 'לא בטוח? צלם אותו אחרי האכלה ובדוק כמה הוא גדל, או האכל פעם אחת וחכה לשיא.';
  }

  const save = () => {
    const fedAgo = where === 'fridge' ? days! * DAY : days! * HOUR;
    setState({
      starter: {
        ...starter,
        type: type!,
        hydration: hyd! / 100,
        name: type === 'stiff' ? 'הסטארטר הקשה שלי' : 'הסטארטר הרגיל שלי',
        inFridge: where === 'fridge',
        lastFedAt: Date.now() - fedAgo,
        grams: grams!,
        weak: cond === 'weak',
        known: true,
        none: false,
      },
    });
    location.hash = '#/';
  };

  return (
    <main>
      <div>
        <span class="sub">הסטארטר</span>
        <h1>מה מצב הסטארטר?</h1>
      </div>
      <Q title="איזה סוג? (הידרציה באחוזים)">
        <Chip<number> v={50} cur={hyd} set={(v) => { setHyd(v); setHydN(''); }}>קשה (50%)</Chip>
        <Chip<number> v={100} cur={hyd} set={(v) => { setHyd(v); setHydN(''); }}>רגיל (100%)</Chip>
        <Num label="או כתוב אחוז" unit="%" value={hydN} min={30} max={200} onValue={(v, raw) => { setHydN(raw); setHyd(v); }} aria="הידרציה באחוזים" />
      </Q>
      <Q title="איפה הוא עכשיו?">
        <Chip<Where> v="fridge" cur={where} set={(v) => { setWhere(v); setDays(null); setCond(null); }}>במקרר</Chip>
        <Chip<Where> v="room" cur={where} set={(v) => { setWhere(v); setDays(null); setCond(null); }}>בחוץ, בטמפרטורת החדר</Chip>
      </Q>
      {where === 'fridge' && (
        <Q title="כמה זמן במקרר?">
          {([[3, 'כמה ימים'], [7, 'שבוע'], [14, 'שבועיים'], [30, 'חודש'], [60, 'יותר מחודש']] as [number, string][]).map(([v, l]) => (
            <Chip v={v} cur={days} set={(x) => { setDays(x); setFridgeN(''); }}>{l}</Chip>
          ))}
          <label class="field" style="flex-direction:row;align-items:center;gap:6px">
            או כתוב
            <input type="number" inputMode="numeric" min="0" max="999" aria-label="כמה זמן במקרר" style="width:72px" value={fridgeN}
              onInput={(e) => { const t = e.currentTarget.value; setFridgeN(t); const n = parseFloat(t); setDays(Number.isFinite(n) && n >= 0 ? Math.round(n * unit) : null); }} />
            <select aria-label="יחידת זמן" value={unit} onChange={(e) => { const u = +e.currentTarget.value as 1 | 7; setUnit(u); const n = parseFloat(fridgeN); if (Number.isFinite(n) && n >= 0) setDays(Math.round(n * u)); }}>
              <option value={1}>ימים</option>
              <option value={7}>שבועות</option>
            </select>
          </label>
        </Q>
      )}
      {where === 'room' && (
        <Q title="מתי האכלת אותו?">
          {([[0, 'הרגע'], [6, 'לפני כמה שעות'], [12, 'בערך חצי יום'], [24, 'אתמול'], [72, 'לפני כמה ימים']] as [number, string][]).map(([v, l]) => (
            <Chip v={v} cur={days} set={(x) => { setDays(x); setHoursN(''); }}>{l}</Chip>
          ))}
          <Num label="או כתוב" unit="שעות" value={hoursN} min={0} max={240} aria="לפני כמה שעות האכלת" onValue={(v, raw) => { setHoursN(raw); setDays(v); }} />
        </Q>
      )}
      {where === 'room' && timeDone && (
        <Q title="איך הוא נראה?">
          <Chip<Cond> v="active" cur={cond} set={setCond}>פעיל ובועבע</Chip>
          <Chip<Cond> v="weak" cur={cond} set={setCond}>חלש, צריך חיזוק</Chip>
          <Chip<Cond> v="unknown" cur={cond} set={setCond}>לא יודע</Chip>
        </Q>
      )}
      {timeDone && (where === 'fridge' || cond) && (
        <Q title="כמה יש לך? (גרם)">
          {[10, 30, 50, 100, 200, 300].map((g) => <Chip v={g} cur={grams} set={(x) => { setGrams(x); setGramsN(''); }}>{g}</Chip>)}
          <Num label="או כתוב" unit="ג'" value={gramsN} min={1} max={5000} aria="כמה גרם יש לך" onValue={(v, raw) => { setGramsN(raw); setGrams(v); }} />
        </Q>
      )}
      {done && (
        <section class="card sun" aria-label="מה עושים עכשיו">
          <strong>מה עושים עכשיו</strong>
          <span data-testid="starter-advice">{advice}</span>
          <button class="btn primary" onClick={save}>שמור ובחזרה לבית</button>
        </section>
      )}
    </main>
  );
}
