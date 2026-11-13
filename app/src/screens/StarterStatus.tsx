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

function Chip<T>({ v, cur, set, children }: { v: T; cur: T | null; set: (v: T) => void; children: preact.ComponentChildren }) {
  return <button class={`chip ${cur === v ? 'on' : ''}`} aria-pressed={cur === v} onClick={() => set(v)}>{children}</button>;
}

/** "How is your starter?": one tap per question, then what to do next. */
export function StarterStatus() {
  const { starter } = useStore();
  const [type, setType] = useState<'stiff' | 'liquid' | null>(null);
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
        hydration: type === 'stiff' ? 0.5 : 1,
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
      <Q title="איזה סוג?">
        <Chip<"stiff" | "liquid"> v="stiff" cur={type} set={setType}>קשה (50%)</Chip>
        <Chip<"stiff" | "liquid"> v="liquid" cur={type} set={setType}>רגיל (100%)</Chip>
      </Q>
      <Q title="איפה הוא עכשיו?">
        <Chip<Where> v="fridge" cur={where} set={(v) => { setWhere(v); setDays(null); setCond(null); }}>במקרר</Chip>
        <Chip<Where> v="room" cur={where} set={(v) => { setWhere(v); setDays(null); setCond(null); }}>בחוץ, בטמפרטורת החדר</Chip>
      </Q>
      {where === 'fridge' && (
        <Q title="כמה זמן במקרר?">
          {([[3, 'כמה ימים'], [7, 'שבוע'], [14, 'שבועיים'], [30, 'חודש'], [60, 'יותר מחודש']] as [number, string][]).map(([v, l]) => (
            <Chip v={v} cur={days} set={setDays}>{l}</Chip>
          ))}
        </Q>
      )}
      {where === 'room' && (
        <Q title="מתי האכלת אותו?">
          {([[0, 'הרגע'], [6, 'לפני כמה שעות'], [12, 'בערך חצי יום'], [24, 'אתמול'], [72, 'לפני כמה ימים']] as [number, string][]).map(([v, l]) => (
            <Chip v={v} cur={days} set={setDays}>{l}</Chip>
          ))}
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
          {[10, 30, 50, 100, 200, 300].map((g) => <Chip v={g} cur={grams} set={setGrams}>{g}</Chip>)}
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
