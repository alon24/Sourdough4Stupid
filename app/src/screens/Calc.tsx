import { useState } from 'preact/hooks';
import { feed, ratioForWindow, seedFor } from '../../../core/src/index';
import { grams } from '../format';
import { useStore } from '../store';

export function Calc() {
  const { starter, roomTempC } = useStore();
  const [target, setTarget] = useState(200);
  const [hours, setHours] = useState(10);
  const [temp, setTemp] = useState(roomTempC);
  const [type, setType] = useState(starter.type);
  const hydration = type === 'stiff' ? 0.5 : 1;

  const valid = target > 0 && hours > 0;
  const choice = ratioForWindow(hours, { type, hydration, tempC: temp });
  const seed = valid ? seedFor(target, [choice.ratio]) : 0;
  const f = valid ? feed(seed, hydration, choice.ratio) : null;
  const h = Math.floor(choice.hours);
  const m = Math.round((choice.hours - h) * 60);

  return (
    <main>
      <div>
        <span class="sub">מחשבון סטארטר</span>
        <h1>כמה להאכיל?</h1>
      </div>

      <div class="seg" role="group" aria-label="סוג סטארטר">
        <button class={type === 'stiff' ? 'on' : ''} aria-pressed={type === 'stiff'} onClick={() => setType('stiff')}>קשה (50%)</button>
        <button class={type === 'liquid' ? 'on' : ''} aria-pressed={type === 'liquid'} onClick={() => setType('liquid')}>רגיל (100%)</button>
      </div>

      <div class="grid3">
        <label class="field">
          צריך (גרם)
          <input type="number" inputMode="numeric" min="1" value={target} onInput={(e) => setTarget(+e.currentTarget.value)} />
        </label>
        <label class="field">
          בעוד (שעות)
          <input type="number" inputMode="decimal" min="1" max="24" value={hours} onInput={(e) => setHours(+e.currentTarget.value)} />
        </label>
        <label class="field">
          טמפ' חדר
          <input type="number" inputMode="numeric" min="10" max="35" value={temp} onInput={(e) => setTemp(+e.currentTarget.value)} />
        </label>
      </div>

      {f && (
        <section class="card sun" aria-label="תוצאה">
          <span class="sub">
            יחס <span class="num">1:{choice.ratio.a}:{+choice.ratio.b.toFixed(1)}</span> · שיא אחרי בערך{' '}
            <span class="num">{h}:{String(m).padStart(2, '0')}</span> שעות
          </span>
          <table class="amounts">
            <tbody>
              <tr><td>סטארטר</td><td data-testid="seed">{grams(seed)}</td></tr>
              <tr><td>קמח</td><td>{grams(f.addFlour)}</td></tr>
              <tr><td>מים</td><td>{grams(f.addWater)}</td></tr>
              <tr><td>יוצא בסך הכול</td><td>{grams(f.total)}</td></tr>
            </tbody>
          </table>
          <span>כולל 10% ספייר ו־30 ג' שחוזרים למקרר.</span>
        </section>
      )}
      {valid && choice.windowTooLong && (
        <section class="card">
          <span>גם ביחס הכי גבוה הוא יגיע לשיא לפני הזמן. אפשר להאכיל מאוחר יותר, או שעה-שעתיים בחוץ ואז למקרר.</span>
        </section>
      )}
      {valid && choice.hours > hours && (
        <section class="card">
          <span>אין מספיק זמן גם ביחס הכי מהיר. כדאי מקום חם יותר או יותר זמן.</span>
        </section>
      )}
    </main>
  );
}
