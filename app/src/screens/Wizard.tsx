import { useState } from 'preact/hooks';
import { plan, type LoafShape } from '../../../core/src/index';
import { toLocalInput } from '../format';
import { daysSinceFed, setState, useStore } from '../store';

const INCLUSIONS = [
  { name: 'זיתים', pct: 0.18, soak: false },
  { name: 'חמוציות', pct: 0.18, soak: true },
  { name: 'צימוקים', pct: 0.18, soak: true },
];
const WEIGHTS = [750, 900, 1000, 1200];

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

  const nothing = loaves + rolls === 0;
  const toggle = (name: string) => setPicked(picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]);

  const go = () => {
    const inclusions = INCLUSIONS.filter((i) => picked.includes(i.name));
    const p = plan({
      outOfOvenAt: at, loaves, rolls, loafWeight: weight, loafShape: shape,
      starter: { type: starter.type, hydration: starter.hydration, daysInFridge: daysSinceFed(starter) },
      roomTempC, kneading, inclusions, coldProof: cold,
    });
    const parts = [loaves && `${loaves} לחמים`, rolls && `${rolls} לחמניות`, ...picked].filter(Boolean);
    const d = p.dough;
    setState({
      plan: {
        title: parts.join(' · '),
        createdAt: Date.now(),
        steps: p.steps,
        build: `${Math.round(p.build.seed)} ג' סטארטר + ${Math.round(p.build.addFlour)} ג' קמח + ${Math.round(p.build.addWater)} ג' מים`,
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
