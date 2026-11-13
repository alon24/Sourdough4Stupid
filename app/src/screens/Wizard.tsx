import { useState } from 'preact/hooks';
import {
  buildChain, hydrationAdvice, plan, suggestHydration, yieldOptions,
  type BlendShare, type LoafShape, type PlanInput,
} from '../../../core/src/index';
import { toActive } from '../activePlan';
import { FlourMix, mixToBlend, type MixItem } from './FlourMix';
import { toLocalInput } from '../format';
import { InclusionsEditor } from './InclusionsEditor';
import { daysSinceFed, setState, useStore, type Recipe } from '../store';

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

export function Wizard({ kind = 'bake', recipeId }: { kind?: 'bake' | 'recipe'; recipeId?: string }) {
  const { starter, roomTempC, inclusions: INCLUSIONS, recipes, flourPresets } = useStore();
  const isRecipe = kind === 'recipe';
  const initial = recipes.find((r) => r.id === recipeId);
  const [name, setName] = useState(initial?.name ?? '');
  const [loaves, setLoaves] = useState(initial?.loaves ?? 2);
  const [rolls, setRolls] = useState(initial?.rolls ?? 0);
  const [weight, setWeight] = useState(initial?.weight ?? 900);
  const [shape, setShape] = useState<LoafShape>(initial?.shape ?? 'free');
  const [at, setAt] = useState(defaultTarget());
  const [picked, setPicked] = useState<string[]>(initial?.inclusions ?? []);
  const [kneading, setKneading] = useState<'hand' | 'machine'>(initial?.kneading ?? 'hand');
  const [autolyse, setAutolyse] = useState(initial?.autolyse ?? true);
  const [enrich, setEnrich] = useState<'none' | 'oil' | 'silan'>(initial?.rollEnrich ?? 'none');
  const [overnight, setOvernight] = useState(false);
  const [folds, setFolds] = useState(initial?.folds ?? 4);
  const [foldGap, setFoldGap] = useState(initial?.foldGapMin ?? 0);
  const [cold, setCold] = useState(initial?.cold ?? true);
  const [blendIdx, setBlendIdx] = useState(0);
  const [hydration, setHydration] = useState(initial?.hydration ?? 0.72);
  const [mixOk, setMixOk] = useState(true);
  /** bumped when a mix is loaded from outside (saved mix, recipe) so the editor restarts from it */
  const [mixEpoch, setMixEpoch] = useState(0);
  const [mix, setMix] = useState<MixItem[] | null>(initial?.mix ?? null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const preset = flourPresets.find((p) => p.id === presetId);
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
    setPresetId(null);
  };
  const changeMix = (items: MixItem[]) => {
    follow(mixToBlend(items));
    setMix(items);
    setPresetId(null);
  };
  const pickFromDropdown = (v: string) => {
    if (v.startsWith('p')) {
      const p = flourPresets.find((x) => x.id === v.slice(1));
      if (!p) return;
      follow(mixToBlend(p.items));
      setMix(p.items);
      setMixEpoch((e) => e + 1);
      setPresetId(p.id);
    } else if (v !== 'custom') pickBlend(+v);
  };
  const startMix = () => changeMix(blend.map((b) => ({ flour: b.id, grams: Math.round(b.pct * 1000) })));

  const [mode, setMode] = useState<'pieces' | 'starter'>('pieces');
  const [want, setWant] = useState(300);
  const [have, setHave] = useState(starter.grams ?? 30);
  const [ready, setReady] = useState(false);
  const nothing = loaves + rolls === 0;
  const starterMode = mode === 'starter';
  const incl = INCLUSIONS.filter((i) => picked.includes(i.name)).reduce((sum, i) => sum + i.pct, 0);
  const options = starterMode && want > 0
    ? yieldOptions(want, { loafWeight: weight, hydration, inclusionPct: incl }).slice(0, 6)
    : [];
  const chain = starterMode && !ready && want > 0 && have > 0
    ? buildChain({ have, target: want, type: starter.type, hydration: starter.hydration, tempC: roomTempC, overnight })
    : [];
  const chainHours = chain.reduce((sum, c) => sum + c.hours, 0);
  const toggle = (name: string) => setPicked(picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]);

  const load = (r: Recipe) => {
    setLoaves(r.loaves); setRolls(r.rolls); setWeight(r.weight); setShape(r.shape); setPicked(r.inclusions);
    setKneading(r.kneading); setCold(r.cold); setFolds(r.folds ?? 4); setFoldGap(r.foldGapMin ?? 0); setAutolyse(r.autolyse ?? true); setEnrich(r.rollEnrich ?? 'none'); setHydration(r.hydration); setMix(r.mix); setMixEpoch((e) => e + 1);
  };
  const saveRecipe = () => {
    const items = mix ?? blend.map((b) => ({ flour: b.id, grams: Math.round(b.pct * 1000) }));
    const r: Recipe = {
      id: initial?.id ?? `r${Date.now()}`, name: name.trim(), fav: initial?.fav ?? false,
      loaves, rolls, weight, shape, inclusions: picked, kneading, cold, folds, foldGapMin: foldGap, autolyse, rollEnrich: enrich, hydration, mix: items,
    };
    setState({ recipes: initial ? recipes.map((x) => (x.id === r.id ? r : x)) : [...recipes, r] });
    location.hash = '#/recipes';
  };

  const currentItems = () => mix ?? blend.map((b) => ({ flour: b.id, grams: Math.round(b.pct * 1000) }));
  const changedFromRecipe = (): boolean => {
    if (!initial) return false;
    const norm = (r: { loaves: number; rolls: number; weight: number; shape: string; inclusions: string[]; kneading: string; cold: boolean; hydration: number; mix: object }) => JSON.stringify([r.loaves, r.rolls, r.weight, r.shape, [...r.inclusions].sort(), r.kneading, r.cold, r.hydration, r.mix]);
    return norm(initial) !== norm({ loaves, rolls, weight, shape, inclusions: picked, kneading, cold, hydration, mix: currentItems() });
  };
  const [askDerive, setAskDerive] = useState(false);
  const go = () => (changedFromRecipe() ? setAskDerive(true) : doGo());
  const derive = () => {
    if (!initial) return;
    const r: Recipe = {
      id: `r${Date.now()}`, name: `${initial.name} (גרסה)`, fav: false, derivedFrom: initial.id,
      loaves, rolls, weight, shape, inclusions: picked, kneading, cold, hydration, mix: currentItems(),
    };
    setState({ recipes: [...recipes, r] });
    doGo();
  };

  const doGo = () => {
    const inclusions = INCLUSIONS.filter((i) => picked.includes(i.name));
    const input: PlanInput = {
      outOfOvenAt: at, loaves, rolls, loafWeight: weight, loafShape: shape,
      starter: {
        type: starter.type, hydration: starter.hydration, daysInFridge: starter.weak ? Math.max(daysSinceFed(starter), 15) : daysSinceFed(starter),
        ...(starterMode && !ready ? { haveGrams: have } : {}),
      },
      ...(starterMode ? { buildTarget: want, starterReady: ready } : {}),
      roomTempC, kneading, inclusions, coldProof: cold, hydration, blend,
      folds, ...(foldGap ? { foldGapMin: foldGap } : {}), autolyse,
      ...(enrich !== 'none' && rolls > 0 ? { rollEnrich: enrich } : {}),
      ...(starterMode && !ready ? { overnightFeed: overnight } : {}), ...(starterMode ? { useAllStarter: true } : {}),
    };
    const parts = [loaves && `${loaves} לחמים`, rolls && `${rolls} לחמניות`, ...picked].filter(Boolean);
    setState({ plan: { ...toActive(plan(input), input, parts.join(' · ')), ...(initial ? { recipeId: initial.id } : {}) } });
    location.hash = '#/plan';
  };

  return (
    <main>
      <div>
        <span class="sub">{isRecipe ? 'מתכון' : 'אפייה חדשה'}</span>
        <h1>{isRecipe ? (initial ? 'עריכת מתכון' : 'מתכון חדש') : 'מה בא לך?'}</h1>
      </div>

      {isRecipe ? (
        <label class="field">
          שם המתכון
          <input value={name} placeholder="למשל: הלחם של שבת" onInput={(e) => setName(e.currentTarget.value)} />
        </label>
      ) : (
        recipes.length > 0 && (
          <label class="field">
            מתכון
            <select aria-label="בחירת מתכון" value={recipeId ?? ''} onChange={(e) => (location.hash = e.currentTarget.value ? `#/new/${e.currentTarget.value}` : '#/new')}>
              <option value="">מאפס</option>
              {recipes.map((r) => <option value={r.id}>{r.name}</option>)}
            </select>
          </label>
        )
      )}

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
          {!ready && (
            <label class="row" style="justify-content:flex-start;min-height:48px">
              <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.currentTarget.checked)} style="width:24px;height:24px" />
              האכלה אחת ללילה (1:6:3, כ־10–12 שעות בחדר)
            </label>
          )}
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

      {!isRecipe && <label class="field">
        יוצא מהתנור
        <input type="datetime-local" value={toLocalInput(at)} onInput={(e) => e.currentTarget.value && setAt(new Date(e.currentTarget.value).getTime())} />
      </label>}

      <div>
        <span class="sub">תוספות</span>
        <div class="chips" style="margin-top:8px">
          {INCLUSIONS.map((i) => (
            <button class={`chip ${picked.includes(i.name) ? 'on' : ''}`} aria-pressed={picked.includes(i.name)} onClick={() => toggle(i.name)}>
              {i.name}
            </button>
          ))}
        </div>
        <InclusionsEditor />
      </div>

      <label class="field">
        קמח
        <select value={presetId && preset ? `p${presetId}` : mix ? 'custom' : String(blendIdx)} onChange={(e) => pickFromDropdown(e.currentTarget.value)}>
          {BLENDS.map((b, i) => (
            <option value={String(i)}>{b.label}</option>
          ))}
          {flourPresets.map((p) => (
            <option value={`p${p.id}`}>{p.name}</option>
          ))}
          {mix && !preset && <option value="custom">הרכב מותאם</option>}
        </select>
      </label>
      {preset && (
        <button class="btn small" aria-label={`מחק את התמהיל ${preset.name}`} onClick={() => { setState({ flourPresets: flourPresets.filter((p) => p.id !== preset.id) }); pickBlend(0); }}>
          מחק את התמהיל "{preset.name}"
        </button>
      )}
      {mix ? (
        <FlourMix key={mixEpoch} items={mix} onChange={changeMix} onSaved={setPresetId} onValidity={setMixOk} />
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
      <div class="seg" role="group" aria-label="אוטוליזה">
        <button class={autolyse ? 'on' : ''} aria-pressed={autolyse} onClick={() => setAutolyse(true)}>עם אוטוליזה</button>
        <button class={!autolyse ? 'on' : ''} aria-pressed={!autolyse} onClick={() => setAutolyse(false)}>הכול יחד, בלי אוטוליזה</button>
      </div>
      {rolls > 0 && (
        <label class="field">
          העשרת הלחמניות (רק אחרי החלוקה)
          <select aria-label="העשרת הלחמניות" value={enrich} onChange={(e) => setEnrich(e.currentTarget.value as 'none' | 'oil' | 'silan')}>
            <option value="none">בלי: כמו הלחם</option>
            <option value="oil">שמן זית (כ־5.5%)</option>
            <option value="silan">סילאן (כ־5.5%)</option>
          </select>
        </label>
      )}
      <section class="card" aria-label="קיפולים">
        <div class="row">
          <strong>קיפולים (לישות)</strong>
          <Stepper label="קיפולים" value={folds} set={setFolds} max={8} />
        </div>
        <label class="field">
          רווח בין קיפולים
          <select aria-label="רווח בין קיפולים" value={foldGap} onChange={(e) => setFoldGap(+e.currentTarget.value)}>
            <option value={0}>אוטומטי ({kneading === 'hand' ? 30 : 45} דק')</option>
            {[20, 30, 45, 60].map((m) => <option value={m}>{m} דק'</option>)}
          </select>
        </label>
        <span class="muted">4 היא ברירת המחדל: כל קיפול מחזק את הגלוטן בלי לישה ארוכה. בצק רטוב או קמח מלא: אפשר להוסיף. אפשר גם להוסיף ולהסיר בתוך התוכנית.</span>
      </section>
      <div class="seg" role="group" aria-label="התפחה אחרונה">
        <button class={cold ? 'on' : ''} aria-pressed={cold} onClick={() => setCold(true)}>לילה במקרר</button>
        <button class={!cold ? 'on' : ''} aria-pressed={!cold} onClick={() => setCold(false)}>אפייה באותו יום</button>
      </div>

      {askDerive && (
        <section class="card" role="dialog" aria-label="שינית את המתכון">
          <strong>שינית משהו מהמתכון "{initial?.name}". לשמור כמתכון חדש?</strong>
          <div class="grid2">
            <button class="btn primary" onClick={derive}>כן, מתכון חדש</button>
            <button class="btn" onClick={doGo}>לא, רק הפעם</button>
          </div>
        </section>
      )}
      {isRecipe ? (
        <button class="btn primary" style="margin-top:auto;font-size:19px" disabled={nothing || !name.trim() || (!!mix && !mixOk)} onClick={saveRecipe}>
          {!name.trim() ? 'צריך שם למתכון' : mix && !mixOk ? 'הקמחים צריכים להגיע ל־100%' : 'שמור מתכון'}
        </button>
      ) : (
        <button class="btn primary" style="margin-top:auto;font-size:19px" disabled={nothing || (!!mix && !mixOk)} onClick={go}>
          {nothing ? 'צריך לבחור לפחות לחם אחד' : mix && !mixOk ? 'הקמחים צריכים להגיע ל־100%' : 'יאללה, תתכנן לי'}
        </button>
      )}
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
