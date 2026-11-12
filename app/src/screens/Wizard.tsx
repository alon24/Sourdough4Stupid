import { useState } from 'preact/hooks';
import {
  buildChain, hydrationAdvice, plan, suggestHydration, yieldOptions,
  type BlendShare, type LoafShape,
} from '../../../core/src/index';
import { FlourMix, mixToBlend, type MixItem } from './FlourMix';
import { toLocalInput } from '../format';
import { daysSinceFed, setState, useStore } from '../store';

const INCLUSIONS = [
  { name: 'זיתים', pct: 0.18, soak: false },
  { name: 'חמוציות', pct: 0.18, soak: true },
  { name: 'צימוקים', pct: 0.18, soak: true },
];
const WEIGHTS = [750, 900, 1000, 1200];

const BLENDS: { label: string; blend: BlendShare[] }[] = [
  { label: 'לבן', blend: [{ id: 'white', pct: 1 }] },
  { label: 'טיפו 0', blend: [{ id: 'tipo0', pct: 1 }] },
  { label: '80% לבן, 20% מלא', blend: [{ id: 'white', pct: 0.8 }, { id: 'whole', pct: 0.2 }] },
  { label: '50% לבן, 50% מלא', blend: [{ id: 'white', pct: 0.5 }, { id: 'whole', pct: 0.5 }] },
  { label: '70% לבן, 30% כוסמין', blend: [{ id: 'white', pct: 0.7 }, { id: 'spelt', pct: 0.3 }] },
  { label: '100% כוסמין', blend: [{ id: 'spelt', pct: 1 }] },
];

function defaultTarget(): number {
  const d = new Date(Date.now() + 2 * 86_400_000);
  d.setHours(9, 45, 0, 0);
  return d.getTime();
}

export function Wizard() {
  const { starter, roomTempC } = useStore();
  const [loaves, setLoaves] = useState(2);
  const [rolls, setRolls] = useState(0);
  const [weight, setWeight] = useState(900);
  const [shape, setShape] = useState<LoafShape>('free');
  const [at, setAt] = useState(defaultTarget());
  const [picked, setPicked] = useState<string[]>([]);
  const [kneading, setKneading] = useState<'hand' | 'machine'>('hand');
  const [cold, setCold] = useState(true);
  const [blendIdx, setBlendIdx] = useState(0);
  const [hydration, setHydration] = useState(0.72);
  const [mix, setMix] = useState<MixItem[] | null>(null);
  const blend = mix ? mixToBlend(mix) : BLENDS[blendIdx]!.blend;
  const advice = hydrationAdvice(blend, hydration);
  // follow the suggestion only while the hydration is still the comfortable one for the old blend
  const follow = (next: BlendShare[]) => {
    if (hydrationAdvice(blend, hydration).level === 'ok') setHydration(suggestHydration(next));
  };
  const pickBlend = (i: number) => {
    follow(BLENDS[i]!.blend);
    setBlendIdx(i);
    setMix(null);
  };
  const changeMix = (items: MixItem[]) => {
    follow(mixToBlend(items));
    setMix(items);
  };
  const startMix = () => changeMix(blend.map((b) => ({ flour: b.id, grams: Math.round(b.pct * 1000) })));

  const [mode, setMode] = useState<'pieces' | 'starter'>('pieces');
  const [want, setWant] = useState(300);
  const [have, setHave] = useState(30);
  const [ready, setReady] = useState(false);
  const nothing = loaves + rolls === 0;
  const starterMode = mode === 'starter';
  const incl = INCLUSIONS.filter((i) => picked.includes(i.name)).reduce((sum, i) => sum + i.pct, 0);
  const options = starterMode && want > 0
    ? yieldOptions(want, { loafWeight: weight, hydration, inclusionPct: incl }).slice(0, 6)
    : [];
  const chain = starterMode && !ready && want > 0 && have > 0
    ? buildChain({ have, target: want, type: starter.type, hydration: starter.hydration, tempC: roomTempC })
    : [];
  const chainHours = chain.reduce((sum, c) => sum + c.hours, 0);
  const toggle = (name: string) => setPicked(picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]);

  const go = () => {
    const inclusions = INCLUSIONS.filter((i) => picked.includes(i.name));
    const p = plan({
      outOfOvenAt: at, loaves, rolls, loafWeight: weight, loafShape: shape,
      starter: {
        type: starter.type, hydration: starter.hydration, daysInFridge: daysSinceFed(starter),
        ...(starterMode && !ready ? { haveGrams: have } : {}),
      },
      ...(starterMode ? { buildTarget: want, starterReady: ready } : {}),
      roomTempC, kneading, inclusions, coldProof: cold, hydration, blend,
    });
    const parts = [loaves && `${loaves} לחמים`, rolls && `${rolls} לחמניות`, ...picked].filter(Boolean);
    const d = p.dough;
    setState({
      plan: {
        title: parts.join(' · '),
        createdAt: Date.now(),
        steps: p.steps,
        build: p.chain.length === 0
          ? 'הסטארטר כבר מוכן'
          : p.chain.map((c, i) => `${p.chain.length > 1 ? `${i + 1}. ` : ''}${Math.round(c.seed)} ג' סטארטר + ${Math.round(c.addFlour)} ג' קמח + ${Math.round(c.addWater)} ג' מים`).join(' · '),
        kneading,
        bulk: p.bulk,
        readings: [],
        amounts: [
          { name: 'קמח', grams: d.addFlour },
          { name: 'מים', grams: d.addWater },
          { name: 'מחמצת', grams: d.levain },
          { name: 'מלח', grams: d.salt },
          ...d.inclusions,
        ],
      },
    });
    location.hash = '#/plan';
  };

  return (
    <main>
      <div>
        <span class="sub">אפייה חדשה</span>
        <h1>מה בא לך?</h1>
      </div>

      <div class="seg" role="group" aria-label="מאיפה מתחילים">
        <button class={!starterMode ? 'on' : ''} aria-pressed={!starterMode} onClick={() => setMode('pieces')}>מכמה לחמים</button>
        <button class={starterMode ? 'on' : ''} aria-pressed={starterMode} onClick={() => setMode('starter')}>מכמה סטארטר</button>
      </div>

      {starterMode && (
        <section class="card" aria-label="כמה סטארטר">
          <div class="grid2">
            <label class="field">
              רוצה סטארטר (גרם)
              <input type="number" inputMode="numeric" min="1" value={want} onInput={(e) => setWant(+e.currentTarget.value)} />
            </label>
            <label class="field">
              יש לי עכשיו (גרם)
              <input type="number" inputMode="numeric" min="1" value={have} disabled={ready} onInput={(e) => setHave(+e.currentTarget.value)} />
            </label>
          </div>
          <label class="row" style="justify-content:flex-start;min-height:48px">
            <input type="checkbox" checked={ready} onChange={(e) => setReady(e.currentTarget.checked)} style="width:24px;height:24px" />
            הסטארטר כבר מוכן ועל השיא
          </label>
          {chain.length > 0 && (
            <span data-testid="chain" class="muted">
              {chain.length === 1 ? 'האכלה אחת' : `${chain.length} האכלות`}, בסך הכול כ־<span class="num">{Math.round(chainHours)}</span> שעות לפני הערבוב.
            </span>
          )}
          <span class="sub">מה יוצא מזה</span>
          <div class="chips" role="group" aria-label="חלוקה">
            {options.map((o) => (
              <button
                class={`chip ${o.loaves === loaves && o.rolls === rolls ? 'on' : ''}`}
                aria-pressed={o.loaves === loaves && o.rolls === rolls}
                onClick={() => { setLoaves(o.loaves); setRolls(o.rolls); }}
              >
                {[o.loaves > 0 && `${o.loaves} לחמים`, o.rolls > 0 && `${o.rolls} לחמניות`].filter(Boolean).join(' + ')}
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="card" style="padding-block:6px">
        <div class="row line">
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
            <strong style="font-size:20px">לחם</strong>
            <div class="row" style="gap:6px">
              <select class="tag" aria-label="משקל לחם" value={weight} onChange={(e) => setWeight(+e.currentTarget.value)}>
                {WEIGHTS.map((w) => (
                  <option value={w}>{w >= 1000 ? `${w / 1000} ק"ג` : `${w} ג'`} כל אחד</option>
                ))}
              </select>
              <select class="tag" aria-label="צורת לחם" value={shape} onChange={(e) => setShape(e.currentTarget.value as LoafShape)}>
                <option value="free">בסיר</option>
                <option value="tin">בתבנית</option>
              </select>
            </div>
          </div>
          <Stepper label="לחם" value={loaves} set={setLoaves} />
        </div>
        <div class="row line">
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
            <strong style="font-size:20px">לחמניות קראסט</strong>
            <span class="tag">90 ג' כל אחת</span>
          </div>
          <Stepper label="לחמניות" value={rolls} set={setRolls} max={24} />
        </div>
      </section>

      <label class="field">
        יוצא מהתנור
        <input type="datetime-local" value={toLocalInput(at)} onInput={(e) => e.currentTarget.value && setAt(new Date(e.currentTarget.value).getTime())} />
      </label>

      <div>
        <span class="sub">תוספות</span>
        <div class="chips" style="margin-top:8px">
          {INCLUSIONS.map((i) => (
            <button class={`chip ${picked.includes(i.name) ? 'on' : ''}`} aria-pressed={picked.includes(i.name)} onClick={() => toggle(i.name)}>
              {i.name}
            </button>
          ))}
        </div>
      </div>

      <label class="field">
        קמח
        <select value={blendIdx} onChange={(e) => pickBlend(+e.currentTarget.value)}>
          {BLENDS.map((b, i) => (
            <option value={i}>{b.label}</option>
          ))}
        </select>
      </label>
      {mix ? (
        <FlourMix items={mix} onChange={changeMix} />
      ) : (
        <button class="btn small" onClick={startMix}>הרכב קמחים משלי</button>
      )}
      <section class="card" aria-label="הידרציה">
        <div class="row">
          <strong>הידרציה</strong>
          <div class="stepper">
            <button aria-label="פחות הידרציה" onClick={() => setHydration(Math.max(0.5, Math.round((hydration - 0.01) * 100) / 100))}>−</button>
            <output data-testid="hydration" aria-label="הידרציה באחוזים"><span class="num">{Math.round(hydration * 100)}%</span></output>
            <button class="plus" aria-label="עוד הידרציה" onClick={() => setHydration(Math.min(0.95, Math.round((hydration + 0.01) * 100) / 100))}>+</button>
          </div>
        </div>
        {advice.level === 'ok' ? (
          <span class="muted">מתאים לתערובת הזו.</span>
        ) : (
          <>
            <span data-testid="hydration-tip">
              {advice.level === 'low'
                ? `לתערובת הזו מומלץ בערך ${Math.round(advice.suggested * 100)}%. ב־${Math.round(hydration * 100)}% הבצק יצא יבש וצפוף: נוח לעבוד איתו, אבל הפירור סגור יותר. אפשר להוסיף מים בהדרגה בזמן הלישה.`
                : `לתערובת הזו מומלץ בערך ${Math.round(advice.suggested * 100)}%. ב־${Math.round(hydration * 100)}% הבצק יהיה דביק ורך: עדיף ידיים רטובות, קיפולים עדינים ועיצוב מהיר, ואולי תבנית.`}
            </span>
            <button class="btn small" onClick={() => setHydration(advice.suggested)}>
              קח את ההצעה: <span class="num">{Math.round(advice.suggested * 100)}%</span>
            </button>
          </>
        )}
      </section>

      <div class="seg" role="group" aria-label="סוג לישה">
        <button class={kneading === 'hand' ? 'on' : ''} aria-pressed={kneading === 'hand'} onClick={() => setKneading('hand')}>לישה ידנית</button>
        <button class={kneading === 'machine' ? 'on' : ''} aria-pressed={kneading === 'machine'} onClick={() => setKneading('machine')}>מכונה</button>
      </div>
      <div class="seg" role="group" aria-label="התפחה אחרונה">
        <button class={cold ? 'on' : ''} aria-pressed={cold} onClick={() => setCold(true)}>לילה במקרר</button>
        <button class={!cold ? 'on' : ''} aria-pressed={!cold} onClick={() => setCold(false)}>אפייה באותו יום</button>
      </div>

      <button class="btn primary" style="margin-top:auto;font-size:19px" disabled={nothing} onClick={go}>
        {nothing ? 'צריך לבחור לפחות לחם אחד' : 'יאללה, תתכנן לי'}
      </button>
    </main>
  );
}

function Stepper({ label, value, set, max = 8 }: { label: string; value: number; set: (n: number) => void; max?: number }) {
  return (
    <div class="stepper">
      <button aria-label={`פחות ${label}`} onClick={() => set(Math.max(0, value - 1))}>−</button>
      <output aria-label={`כמות ${label}`}>{value}</output>
      <button class="plus" aria-label={`עוד ${label}`} onClick={() => set(Math.min(max, value + 1))}>+</button>
    </div>
  );
}
