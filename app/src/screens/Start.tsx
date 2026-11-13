import { useState } from 'preact/hooks';
import { plan as makePlan, resumeAt, type PlanInput } from '../../../core/src/index';
import { toActive } from '../activePlan';
import { hhmm } from '../format';
import { getState, setState, useStore } from '../store';

type Starter = 'none' | 'fridge' | 'active' | 'weak';
type Scale = 'yes' | 'no' | 'unsure';
const HAVE = [10, 20, 30, 50, 100, 200];

function Q({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section class="card">
      <h2 style="margin:0">{title}</h2>
      <div class="chips" style="flex-direction:column;align-items:stretch">{children}</div>
    </section>
  );
}

/** "Starting the bake": a short multiple-choice questionnaire that re-plans from where you really are. */
export function Start() {
  const { plan, starter: known } = useStore();
  /** the starter card is the one source of truth: its state is what this screen starts from */
  const fromCard: Starter | null = !known.known && !known.none ? null : known.none ? 'none' : known.inFridge ? 'fridge' : known.weak ? 'weak' : 'active';
  const [starter, setStarter] = useState<Starter | null>(fromCard);
  const [scale, setScale] = useState<Scale | null>(null);
  const [have, setHave] = useState<number | null>(null);

  const input = plan?.input;
  if (!plan || !input) {
    return (
      <main>
        <h1>אין אפייה פתוחה</h1>
        <p class="muted">קודם מתכננים אפייה, ואז אפשר לסמן איפה אתה בה.</p>
        <a class="btn primary" href="#/new">אפייה חדשה</a>
      </main>
    );
  }

  const needScale = starter !== null && starter !== 'active' && scale !== 'no';
  const haveQ = needScale && (scale === 'yes' || scale === 'unsure' || starter === 'none');
  const ready = starter === 'active' || scale === 'no';
  const stepsReady = starter !== null && (starter === 'active' || scale !== null) && (!haveQ || have !== null || starter === 'none');

  const replan = (): PlanInput => ({
    ...input,
    starter: {
      ...input.starter,
      daysInFridge: starter === 'fridge' ? Math.max(input.starter.daysInFridge, 1) : starter === 'weak' || starter === 'none' ? 7 : 0,
      ...(ready ? {} : { haveGrams: starter === 'none' ? 10 : (have ?? input.starter.haveGrams ?? 30) }),
    },
    starterReady: ready,
  });

  const now = Date.now();
  const next = stepsReady ? replan() : null;
  const steps = next ? makePlan(next, now).steps : [];

  const apply = (stepId: string | null) => {
    if (!next) return;
    const p = makePlan(next, now);
    const active = toActive(p, next, plan.title, plan.createdAt);
    const steps = stepId ? resumeAt(p.steps, stepId, now) : p.steps;
    // keep everything the bake already holds: its recipe, photos, readings and notes
    setState({ plan: { ...plan, ...active, createdAt: plan.createdAt, steps, ...(plan.recipeId ? { recipeId: plan.recipeId } : {}), ...(plan.photos ? { photos: plan.photos } : {}), ...(plan.readings?.length ? { readings: plan.readings } : {}) } });
    location.hash = '#/plan';
  };

  return (
    <main>
      <div>
        <span class="sub">התחלת ביצוע · {plan.title}</span>
        <h1>איפה אתה עכשיו?</h1>
      </div>

      {fromCard && <p class="muted" data-testid="start-from-card">לפי כרטיס הסטארטר שלך. אם זה השתנה, בחר מחדש. <a href="#/starter">עדכון מצב הסטארטר</a></p>}
      <Q title="יש לך סטארטר? באיזה מצב?">
        {([['none', 'אין לי'], ['fridge', 'במקרר'], ['active', 'פעיל ובועבע'], ['weak', 'חלש ועייף']] as [Starter, string][]).map(([k, l]) => (
          <button class={`chip ${starter === k ? 'on' : ''}`} aria-pressed={starter === k} onClick={() => { setStarter(k); setScale(null); setHave(null); }}>{l}</button>
        ))}
      </Q>

      {starter === 'none' && (
        <p class="muted">בלי סטארטר צריך להתחיל מכמה גרמים בודדים (למשל מחבר/ה). התוכנית תבנה אותו בכמה האכלות.</p>
      )}

      {starter !== null && starter !== 'active' && starter !== 'none' && (
        <Q title="צריך להגדיל אותו?">
          {([['yes', 'כן, צריך יותר'], ['no', 'לא, יש מספיק'], ['unsure', 'לא בטוח']] as [Scale, string][]).map(([k, l]) => (
            <button class={`chip ${scale === k ? 'on' : ''}`} aria-pressed={scale === k} onClick={() => setScale(k)}>{l}</button>
          ))}
        </Q>
      )}

      {haveQ && starter !== 'none' && (
        <Q title="כמה סטארטר יש לך? (גרם)">
          <div class="chips">
            {HAVE.map((g) => (
              <button class={`chip ${have === g ? 'on' : ''}`} aria-pressed={have === g} onClick={() => setHave(g)}>{g}</button>
            ))}
          </div>
        </Q>
      )}

      {stepsReady && (
        <Q title="באיזה שלב אתה?">
          <button class="chip" onClick={() => apply(null)}>עוד לא התחלתי, לפי התוכנית</button>
          {steps.map((s) => (
            <button class="chip" onClick={() => apply(s.id)}>
              {s.title} <span class="muted num">{hhmm(s.at)}</span>
            </button>
          ))}
        </Q>
      )}
    </main>
  );
}
