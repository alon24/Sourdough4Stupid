import { useState } from 'preact/hooks';
import {
  buildChain, combineCheck, loafHe, rollsHe, DEFAULT_ITEM_TYPES, mergeItems, scaleItems, type Part, hydrationAdvice, itemFrom, plan, starterCheck, starterNeed, suggestHydration, type Item,
  type BlendShare, type LoafShape, type PlanInput,
} from '../../../core/src/index';
import { allFlours } from '../../../core/src/index';
import { toActive } from '../activePlan';
import { FlourMix, mixToBlend, type MixItem } from './FlourMix';
import { dayName, hhmm, loavesText, shortDate, toLocalInput } from '../format';
import { InclusionsEditor } from './InclusionsEditor';
import { addPlan, allPlans, daysSinceFed, getState, setState, useStore, type Recipe } from '../store';

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
  const [hydration, setHydration] = useState(initial?.hydration ?? 0.72);
  /** the recipe's base batch, as saved */
  const [baseItems, setItems] = useState<Item[]>(initial ? itemsOf(initial) : [itemFrom(DEFAULT_ITEM_TYPES[0]!)]);
  /** how many of the base batch to make now, and other recipes to bake from the same dough */
  const [mult, setMult] = useState(1);
  const [extras, setExtras] = useState<{ recipeId: string; mult: number }[]>([]);
  const extraRecipes = extras.map((e) => ({ e, r: recipes.find((x) => x.id === e.recipeId) })).filter((x): x is { e: { recipeId: string; mult: number }; r: Recipe } => !!x.r);
  const parts: Part[] = [
    { label: name.trim() || initial?.name || 'המתכון הזה', items: scaleItems(baseItems, mult), hydration },
    ...extraRecipes.map(({ e, r }) => ({ label: r.name, items: scaleItems(itemsOf(r), e.mult), hydration: r.hydration })),
  ];
  const combo = combineCheck(parts);
  /** what is actually planned: the scaled base batch plus every recipe that can share its dough */
  const items = mergeItems(combo.together.map((p) => p.items));
  const bLoaves = baseItems.filter((i) => groupOf(i) === 'loaf').reduce((n, i) => n + i.count, 0);
  const bRolls = baseItems.filter((i) => groupOf(i) === 'rolls').reduce((n, i) => n + i.count, 0);
  const bLoafItems = baseItems.filter((i) => groupOf(i) === 'loaf');
  const bWeight = bLoaves ? Math.round(bLoafItems.reduce((n, i) => n + i.count * i.weight, 0) / bLoaves) : 1000;
  const loafItems = items.filter((i) => groupOf(i) === 'loaf');
  const rollItems = items.filter((i) => groupOf(i) === 'rolls');
  const loaves = loafItems.reduce((n, i) => n + i.count, 0);
  const rolls = rollItems.reduce((n, i) => n + i.count, 0);
  const weight = loaves ? Math.round(loafItems.reduce((n, i) => n + i.count * i.weight, 0) / loaves) : 1000;
  const rollWeight = rolls ? Math.round(rollItems.reduce((n, i) => n + i.count * i.weight, 0) / rolls) : 90;
  const rollsName = rollItems.length === 1 ? (rollItems[0]!.name ?? 'לחמניות') : 'לחמניות';
  const rollsBake = rollItems.map((i) => DEFAULT_ITEM_TYPES.find((t) => t.id === i.type)?.bakeNote).find(Boolean);
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
  const [mixOk, setMixOk] = useState(true);
  /** bumped when a mix is loaded from outside (saved mix, recipe) so the editor restarts from it */
  const [mixEpoch, setMixEpoch] = useState(0);
  const [mix, setMix] = useState<MixItem[] | null>(initial?.mix ?? null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const preset = flourPresets.find((p) => p.id === presetId);
  const blend = mix ? mixToBlend(mix) : BLENDS[blendIdx]!.blend;
  /** a bake shows its flour as one short line; the editor opens on "ערוך" (a recipe always shows the editor) */
  const [editFlour, setEditFlour] = useState(false);
  const flourLine = blend.map((b) => `${allFlours().find((f) => f.id === b.id)?.name ?? b.id} ${Math.round(b.pct * 100)}%`).join(' + ');
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

  const [useOverride, setUseOverride] = useState<number | null>(null);
  /** until the baker types an amount (or has told the app one), assume there is enough: an unknown starter must not block */
  /** starter already promised to other bakes that have not used it yet (their mixing step is still ahead) */
  const reservedFor = allPlans(getState()).filter((p) => p.input?.buildTarget && p.steps.find((x) => x.kind === 'mix')?.doneAt === undefined);
  const reserved = reservedFor.reduce((n, p) => n + (p.input?.buildTarget ?? 0), 0);
  const [haveRaw, setHave] = useState<number | null>(starter.grams !== undefined ? Math.max(0, starter.grams - (isRecipe ? 0 : reserved)) : null);
  const have = haveRaw ?? Math.max(100, Math.round(starterNeed(items).grams / 5) * 5);
  const check = starterCheck(items, have);
  const want = useOverride ?? (check.need || 100);
  const doughG = starterNeed(items).dough;
  const short = check.need > 0 && have < want * 0.9;
  const [ready, setReady] = useState(false);
  /** "I already have enough": ask for the real amount before the block is lifted */
  const [confirmEnough, setConfirmEnough] = useState(false);
  /** the baker chose to grow the starter: show the feeding plan and wait for a go-ahead */
  const [feedPlan, setFeedPlan] = useState(false);
  const [enoughN, setEnoughN] = useState('');
  const pieceItems = baseItems;
  const nothing = loaves + rolls === 0;
  const starterMode = true;
  const chain = starterMode && !ready && want > 0 && have > 0
    ? buildChain({ have, target: want, type: starter.type, hydration: starter.hydration, tempC: roomTempC, overnight })
    : [];
  const chainHours = chain.reduce((sum, c) => sum + c.hours, 0);
  const toggle = (name: string) => setPicked(picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]);

  const load = (r: Recipe) => {
    setItems(itemsOf(r)); setUseOverride(null); setShape(r.shape); setPicked(r.inclusions);
    setKneading(r.kneading); setCold(r.cold); setFolds(r.folds ?? 4); setFoldGap(r.foldGapMin ?? 0); setAutolyse(r.autolyse ?? true); setEnrich(r.rollEnrich ?? 'none'); setHydration(r.hydration); setMix(r.mix); setMixEpoch((e) => e + 1);
  };
  const saveRecipe = () => {
    const items = mix ?? blend.map((b) => ({ flour: b.id, grams: Math.round(b.pct * 1000) }));
    const itemsToSave = pieceItems;
    const r: Recipe = {
      id: initial?.id ?? `r${Date.now()}`, name: name.trim(), fav: initial?.fav ?? false,
      loaves: bLoaves, rolls: bRolls, weight: bWeight, shape, inclusions: picked, kneading, cold, folds, foldGapMin: foldGap, autolyse, rollEnrich: enrich, hydration, mix: items, items: itemsToSave,
    };
    setState({ recipes: initial ? recipes.map((x) => (x.id === r.id ? r : x)) : [...recipes, r] });
    location.hash = '#/recipes';
  };

  const currentItems = () => mix ?? blend.map((b) => ({ flour: b.id, grams: Math.round(b.pct * 1000) }));
  const changedFromRecipe = (): boolean => {
    if (!initial) return false;
    const norm = (r: { loaves: number; rolls: number; weight: number; shape: string; inclusions?: string[]; kneading: string; cold: boolean; hydration: number; mix: object }) => JSON.stringify([r.loaves, r.rolls, r.weight, r.shape, 0, r.kneading, r.cold, r.hydration, r.mix]);
    return norm(initial) !== norm({ loaves: bLoaves, rolls: bRolls, weight: bWeight, shape, inclusions: picked, kneading, cold, hydration, mix: currentItems() }) || JSON.stringify(itemsOf(initial)) !== JSON.stringify(baseItems);
  };
  /** the baker asked to keep this bake's changes as a new recipe too */
  const [saveNew, setSaveNew] = useState(false);
  const go = () => (saveNew && changedFromRecipe() ? derive() : doGo());
  /** a new bake is a short walk: what, when, adjustments, summary and starter. A recipe is one page. */
  const [step, setStep] = useState(1);
  const on = (n: number) => isRecipe || step === n;
  const STEPS = ['מה אופים', 'מתי', 'התאמות', 'סיכום וסטארטר'];
  const derive = () => {
    if (!initial) return;
    const r: Recipe = {
      id: `r${Date.now()}`, name: `${initial.name} (גרסה)`, fav: false, derivedFrom: initial.id,
      loaves: bLoaves, rolls: bRolls, weight: bWeight, shape, inclusions: picked, kneading, cold, hydration, mix: currentItems(), items: pieceItems,
    };
    setState({ recipes: [...recipes, r] });
    doGo();
  };

  const doGo = () => {
    const inclusions = INCLUSIONS.filter((i) => picked.includes(i.name));
    const input: PlanInput = {
      outOfOvenAt: at, loaves, rolls, loafWeight: weight, rollWeight, loafShape: shape,
      ...(rolls > 0 ? { rollsName, ...(rollsBake ? { rollsBake } : {}) } : {}),
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
    const parts = [loaves && loavesText(loaves), rolls && rollsHe(rolls, rollsName), ...picked].filter(Boolean);
    const base = `${initial?.name ?? parts.join(' · ')}, ${shortDate(at)}`;
    const taken = new Set(allPlans(getState()).map((p) => p.title));
    let title = base;
    for (let n = 2; taken.has(title); n++) title = `${base} (${n})`;
    const act = toActive(plan(input), input, title);
    addPlan({ ...act, ...(combo.notes.length ? { splitNotes: combo.notes } : {}), ...(initial ? { recipeId: initial.id } : {}) });
    location.hash = '#/plan';
  };

  return (
    <main>
      <div>
        <span class="sub">{isRecipe ? 'מתכון' : 'אפייה חדשה'}</span>
        <h1>{isRecipe ? (initial ? 'עריכת מתכון' : 'מתכון חדש') : 'מה בא לך?'}</h1>
        {!isRecipe && <span class="muted" data-testid="wizard-step">שלב {step} מתוך 4: {STEPS[step - 1]}</span>}
      </div>

<div class="stepbox" hidden={!on(1)}>
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
</div>

<div class="stepbox" hidden={!on(4)}>
      {isRecipe ? (
        <section class="card" aria-label="סטארטר במתכון" data-testid="recipe-starter">
          <strong>כמה סטארטר צריך</strong>
          <span class="muted">
            {check.need > 0 ? <>ל־<span class="num">{Math.round(doughG)}</span> ג' בצק צריך כ־<span class="num">{check.need}</span> ג' סטארטר פעיל. </> : null}
            המתכון קובע כמה סטארטר צריך, בלי קשר לכמה יש לך עכשיו. הבדיקה אם יש מספיק נעשית רק כשמתחילים אפייה.
          </span>
        </section>
      ) : (
      <section class="card" aria-label="כמה סטארטר" data-testid="starter-section">
        <div class="row">
          <strong>הסטארטר</strong>
          <span class="muted" data-testid="starter-state">
            {starter.none ? 'אין לך סטארטר עדיין. ' : starter.known ? `${starter.inFridge ? 'במקרר' : 'בחוץ'}, הואכל ${daysSinceFed(starter) === 0 ? 'היום' : `לפני ${daysSinceFed(starter)} ימים`}${starter.weak ? ', חלש' : ''}. ` : 'מצב הסטארטר עוד לא הוגדר. '}
            <a href="#/starter">עדכון</a>
          </span>
        </div>
        {reservedFor.length > 0 && (
          <span class="muted" data-testid="starter-reserved">
            כבר משוריינים {reserved} ג' סטארטר לאפיות רצות: {reservedFor.map((p) => p.title).join(', ')}. הכמות שבשדה כבר בלי זה.
          </span>
        )}
        <div class="need-line">
          <span data-testid="starter-need">ל־<span class="num">{Math.round(doughG)}</span> ג' בצק צריך <strong class="num">{want}</strong> ג' סטארטר מוכן</span>
          <label class="mini">
            יש לי
            <input type="number" inputMode="numeric" min="1" aria-label="יש לי עכשיו (גרם)" value={have} onInput={(e) => { const v = +e.currentTarget.value; setHave(v); if (v > 0) setState({ starter: { ...starter, grams: v } }); }} />
            ג'
          </label>
        </div>
        <details class="adv">
          <summary>שינוי הכמות והאפשרויות</summary>
          <label class="field">
            כמה סטארטר לשים בבצק (גרם)
            <input type="number" inputMode="numeric" min="1" value={want} onInput={(e) => setUseOverride(+e.currentTarget.value || null)} />
          </label>
          <label class="row" style="justify-content:flex-start;min-height:44px">
            <input type="checkbox" checked={ready} onChange={(e) => { const on = e.currentTarget.checked; if (on && short) { setConfirmEnough(true); setEnoughN(String(want)); } else setReady(on); }} style="width:24px;height:24px" />
            הסטארטר כבר מוכן ועל השיא
          </label>
          {!ready && (
            <label class="row" style="justify-content:flex-start;min-height:44px">
              <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.currentTarget.checked)} style="width:24px;height:24px" />
              האכלה אחת ללילה (1:6:3, כ־10–12 שעות)
            </label>
          )}
        </details>
        {short && (
          <div role="alert" data-testid="starter-warning" class="warn">
            <strong>חסרים <span class="num">{Math.round(want - have)}</span> ג' סטארטר</strong>
            <div class="grid2">
              <button class="btn small primary" onClick={() => { setFeedPlan(true); setConfirmEnough(false); }} disabled={nothing} aria-expanded={feedPlan}>תכנן לי האכלות</button>
              <button class="btn small" onClick={() => { setConfirmEnough(true); setEnoughN(String(want)); }}>יש לי מספיק מוכן</button>
            </div>
            {want > check.need * 1.3 ? <button class="btn small" onClick={() => setUseOverride(check.need)}>או להשתמש רק ב־{check.need} ג' (מספיק ל־{Math.round(doughG)} ג' בצק)</button> : null}
            {confirmEnough && (
              <div data-testid="enough-confirm" class="row" style="flex-wrap:wrap;gap:8px;justify-content:flex-start">
                <label class="mini">
                  כמה מוכן ועל השיא יש לך?
                  <input type="number" inputMode="numeric" min="1" aria-label="כמה סטארטר מוכן יש לך" value={enoughN} onInput={(e) => setEnoughN(e.currentTarget.value)} />
                  ג'
                </label>
                {(parseFloat(enoughN) || 0) < want * 0.9 && <span class="muted" role="status" data-testid="enough-low">זה עדיין פחות מ־{want} ג'. צריך להגדיל את הסטארטר או לבחור כמות קטנה יותר.</span>}
                <button class="btn small primary" disabled={(parseFloat(enoughN) || 0) < want * 0.9} onClick={() => { const v = Math.round(parseFloat(enoughN)); setHave(v); setReady(true); setConfirmEnough(false); setState({ starter: { ...starter, grams: v } }); }}>
                  אישור, הסטארטר מוכן
                </button>
              </div>
            )}
          </div>
        )}
        {short && feedPlan && chain.length > 0 && (
          <div class="card mint" data-testid="feed-plan" aria-label="תכנון הגדלת הסטארטר" style="gap:8px">
            <strong>תכנון הגדלת הסטארטר</strong>
            <span>
              יש לך <span class="num">{have}</span> ג', צריך <span class="num">{want}</span> ג' מוכנים ועל השיא. אחרי ההגדלה נשארים עוד כ־30 ג' להמשך (המחמצת שלך לפעם הבאה).
            </span>
            <span data-testid="feed-summary">
              {chain.length === 1 ? 'האכלה אחת' : `${chain.length} האכלות`} · כ־<span class="num">{Math.round(chainHours)}</span> שעות בסך הכול · אם מתחילים עכשיו, מוכן {dayName(Date.now() + chainHours * 3_600_000)} בערך ב־<span class="num">{hhmm(Date.now() + chainHours * 3_600_000)}</span>
            </span>
            {chain.map((c, i) => (
              <div class="row line" data-testid="feed-stage" style="min-height:0;padding-block:8px;flex-wrap:wrap">
                <div style="display:flex;flex-direction:column">
                  <strong>האכלה {i + 1} מתוך {chain.length}</strong>
                  <span class="muted">יחס 1 : {Math.round(c.ratio.a * 10) / 10} : {Math.round(c.ratio.b * 10) / 10} (סטארטר : קמח : מים)</span>
                </div>
                <span>
                  {Math.round(c.seed)} ג' סטארטר + {Math.round(c.addFlour)} ג' קמח + {Math.round(c.addWater)} ג' מים = <span class="num">{Math.round(c.total)}</span> ג', כ־{Math.round(c.hours)} שעות
                </span>
              </div>
            ))}
            <label class="row" style="justify-content:flex-start;min-height:44px">
              <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.currentTarget.checked)} style="width:24px;height:24px" />
              הכול בהאכלה אחת, ללילה
            </label>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button class="btn primary small" onClick={go}>אישור, ממשיכים לתוכנית</button>
              <button class="btn small" onClick={() => setFeedPlan(false)}>חזרה</button>
            </div>
          </div>
        )}
        {!short && check.status === 'lots' && (
          <div role="alert" data-testid="starter-lots" class="warn">
            <strong>בטוח בכמות הסטארטר?</strong>
            <span>המתכון מבקש בדרך כלל כ־<span class="num">{check.need}</span> ג', ויש לך <span class="num">{have}</span>. מה להשתמש?</span>
            <div class="chips" role="group" aria-label="כמה סטארטר להשתמש">
              {check.options.map((o) => (
                <button class={`chip ${want === o.grams ? 'on' : ''}`} aria-pressed={want === o.grams} onClick={() => setUseOverride(o.grams)}>
                  {o.grams} ג' · נשארים {o.leftover} ג'{o.speedPct > 0 ? ` · התפחה מהירה ב־${o.speedPct}%` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        {!short && check.status === 'ok' && <span class="muted" data-testid="starter-ok">הכמות מתאימה: כ־{check.need} ג' ויש {have}.</span>}
        {chain.length > 0 && (
          <span data-testid="chain" class="muted">
            {chain.length === 1 ? 'האכלה אחת' : `${chain.length} האכלות`}, בסך הכול כ־<span class="num">{Math.round(chainHours)}</span> שעות לפני הערבוב.
          </span>
        )}
      </section>
      )}
</div>

<div class="stepbox" hidden={!on(1)}>
      <section class="card" aria-label="מה אופים" data-testid="items">
        <strong>מה אופים</strong>
        {baseItems.map((it, k) => {
          const isLoaf = groupOf(it) === 'loaf';
          const nm = it.type === 'loaf' ? 'לחם' : it.type === 'rolls' ? 'לחמניות' : (it.name ?? 'פריט');
          const upd = (patch: Partial<Item>) => setItems(baseItems.map((x, j) => (j === k ? { ...x, ...patch } : x)));
          return (
            <div class="item" data-testid="item-row">
              <div class="item-head">
                <strong>{it.type === 'rolls' ? 'לחמניות קראסט' : nm}</strong>
                <div class="item-count">
                  <Stepper label={nm} value={it.count} set={(n) => upd({ count: n })} max={24} />
                  {baseItems.length > 1 && <button class="x" aria-label={`הסר ${nm}`} onClick={() => setItems(baseItems.filter((_, j) => j !== k))}>×</button>}
                </div>
              </div>
              <div class="minis">
                {isLoaf ? (
                  <>
                    <label class="mini">
                      <select aria-label={it.type === 'loaf' ? 'משקל לחם' : `משקל ${nm}`} value={it.weight} onChange={(e) => upd({ weight: +e.currentTarget.value })}>
                        {[...new Set([...WEIGHTS, it.weight])].sort((a, b) => a - b).map((w) => (
                          <option value={w}>{w >= 1000 ? `${w / 1000} ק"ג` : `${w} ג'`} כל אחד</option>
                        ))}
                      </select>
                    </label>
                    <label class="mini">
                      <select aria-label="צורת לחם" value={shape} onChange={(e) => setShape(e.currentTarget.value as LoafShape)}>
                        <option value="free">בסיר</option>
                        <option value="tin">בתבנית</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <label class="mini">
                    <input type="number" inputMode="numeric" min="10" aria-label={`משקל ${nm}`} value={it.weight} onInput={(e) => upd({ weight: Math.max(10, +e.currentTarget.value || 10) })} />
                    ג' כל אחת
                  </label>
                )}
                <label class="mini">
                  סטארטר
                  <input type="number" inputMode="numeric" min="1" max="40" aria-label={`אחוז סטארטר ${nm}`} value={Math.round(it.starterPct * 100)} onInput={(e) => upd({ starterPct: Math.min(0.4, Math.max(0.01, (+e.currentTarget.value || 1) / 100)) })} />%
                  <span class="num" data-testid="item-starter-g">= {Math.round(it.count * it.weight * it.starterPct)} ג'</span>
                </label>
              </div>
            </div>
          );
        })}
        <span class="muted" data-testid="percent-hint">סטארטר הוא חלק ממשקל הבצק, למשל 10% מ־900 ג' בצק = 90 ג' סטארטר. יותר סטארטר: התפחה מהירה וחמוץ פחות.</span>
        <div class="pills" role="group" aria-label="הוספת פריט">
          {DEFAULT_ITEM_TYPES.filter((t) => t.id !== 'custom' && !baseItems.some((i) => i.type === t.id)).map((t) => (
            <button class="pill" onClick={() => setItems([...baseItems, itemFrom(t)])}>+ {t.name}</button>
          ))}
          <button class="pill" onClick={() => {
            const n = prompt('איך קוראים לפריט?');
            if (n?.trim()) setItems([...baseItems, { ...itemFrom(DEFAULT_ITEM_TYPES.find((t) => t.id === 'custom')!), name: n.trim() }]);
          }}>+ פריט משלי</button>
        </div>
      </section>

      {!isRecipe && (
        <section class="card" aria-label="כמה מהמתכון" data-testid="scale">
          <div class="row">
            <div style="display:flex;flex-direction:column"><strong>כמה פעמים את המתכון?</strong><span class="muted">אצווה אחת: {describe(baseItems)}</span></div>
            <Stepper label="הכפלת המתכון" value={mult} set={(n) => setMult(Math.max(1, n))} max={10} />
          </div>
          <span data-testid="scaled">{mult > 1 ? `×${mult}: ` : ''}{describe(scaleItems(baseItems, mult))}</span>
          {recipes.filter((r) => r.id !== initial?.id && !extras.some((e) => e.recipeId === r.id)).length > 0 && (
            <label class="field">
              לשלב עוד מתכון באותה אפייה
              <select aria-label="הוספת מתכון לשילוב" value="" onChange={(e) => { const id = e.currentTarget.value; if (id) setExtras([...extras, { recipeId: id, mult: 1 }]); }}>
                <option value="">בחר מתכון...</option>
                {recipes.filter((r) => r.id !== initial?.id && !extras.some((e) => e.recipeId === r.id)).map((r) => <option value={r.id}>{r.name} ({describe(itemsOf(r))})</option>)}
              </select>
            </label>
          )}
          {extraRecipes.map(({ e, r }) => (
            <div class="row line" data-testid="extra-recipe">
              <div style="display:flex;flex-direction:column">
                <strong>{r.name}</strong>
                <span class="muted">{describe(scaleItems(itemsOf(r), e.mult))}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
                <Stepper label={`הכפלת ${r.name}`} value={e.mult} set={(n) => setExtras(extras.map((x) => (x === e ? { ...x, mult: Math.max(1, n) } : x)))} max={10} />
                <button class="btn small" aria-label={`הסר ${r.name}`} onClick={() => setExtras(extras.filter((x) => x !== e))}>הסר</button>
              </div>
            </div>
          ))}
          {combo.notes.map((n) => <span class="tag" data-testid="combine-note">{n}</span>)}
          {combo.separate.map((x) => (
            <span role="alert" data-testid="combine-separate" style="color:var(--coral)">{x.why}</span>
          ))}
          {combo.separate.length > 0 && (
            <button class="btn small" onClick={() => setExtras(extras.filter((e) => !combo.separate.some((x) => x.part.label === recipes.find((r) => r.id === e.recipeId)?.name)))}>
              לתכנן רק את מה שמתחלק, ואת השאר אחר כך בנפרד
            </button>
          )}
          {extras.length > 0 && combo.separate.length === 0 && <span class="muted">הכול מתחלק מאותו בצק: {describe(items)}.</span>}
          <span class="muted" data-testid="scaled-total">בסך הכול בצק: {Math.round(starterNeed(items).dough)} ג', סטארטר: {Math.round(starterNeed(items).grams)} ג'.</span>
        </section>
      )}
</div>

<div class="stepbox" hidden={!on(2)}>
      {!isRecipe && <label class="field">
        יוצא מהתנור
        <input type="datetime-local" value={toLocalInput(at)} onInput={(e) => e.currentTarget.value && setAt(new Date(e.currentTarget.value).getTime())} />
      </label>}
</div>

<div class="stepbox" hidden={!on(3)}>
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

      {!isRecipe && !editFlour && (
        <div class="card row" aria-label="קמח" data-testid="flour-summary">
          <div style="display:flex;flex-direction:column;min-width:0"><strong>קמח</strong><span class="muted">{preset ? preset.name : flourLine}</span></div>
          <button class="pill" aria-label="ערוך קמחים" onClick={() => setEditFlour(true)}>ערוך</button>
        </div>
      )}
      {(isRecipe || editFlour) && (
        <>
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
        </>
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
        <span class="muted">4 הוא ברירת המחדל. בצק רטוב או קמח מלא: אפשר להוסיף. אפשר לשנות גם בתוך התוכנית.</span>
      </section>
</div>
<div class="stepbox" hidden={!on(2)}>
      <div class="seg" role="group" aria-label="התפחה אחרונה">
        <button class={cold ? 'on' : ''} aria-pressed={cold} onClick={() => setCold(true)}>לילה במקרר</button>
        <button class={!cold ? 'on' : ''} aria-pressed={!cold} onClick={() => setCold(false)}>אפייה באותו יום</button>
      </div>
</div>

      {!isRecipe && step === 4 && changedFromRecipe() && (
        <label class="card row" style="justify-content:flex-start;min-height:48px" data-testid="changed-from-recipe">
          <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.currentTarget.checked)} style="width:24px;height:24px" />
          <span>שונה מהמתכון "{initial?.name}" (רק באפייה הזאת). לשמור גם כמתכון חדש?</span>
        </label>
      )}
      {isRecipe ? (
        <button class="btn primary" style="margin-top:auto;font-size:19px" disabled={nothing || !name.trim() || (!!mix && !mixOk)} onClick={saveRecipe}>
          {!name.trim() ? 'צריך שם למתכון' : mix && !mixOk ? 'הקמחים צריכים להגיע ל־100%' : 'שמור מתכון'}
        </button>
      ) : step < 4 ? (
        <div class="grid2" style="margin-top:auto">
          <button class="btn" disabled={step === 1} onClick={() => { setStep(step - 1); scrollTo(0, 0); }}>הקודם</button>
          <button class="btn primary" style="font-size:19px" disabled={step === 1 && nothing} onClick={() => { setStep(step + 1); scrollTo(0, 0); }}>הבא: {STEPS[step]}</button>
        </div>
      ) : (
        <button class="btn primary" style="margin-top:auto;font-size:19px" disabled={nothing || (!!mix && !mixOk)} onClick={short ? () => { setFeedPlan(true); setConfirmEnough(false); setTimeout(() => document.querySelector('[data-testid="feed-plan"]')?.scrollIntoView({ block: 'center' }), 50); } : go}>
          {nothing ? 'צריך לבחור לפחות לחם אחד' : mix && !mixOk ? 'הקמחים צריכים להגיע ל־100%' : short ? 'להמשיך לתכנון ההאכלות' : 'יאללה, תתכנן לי'}
        </button>
      )}
      {!isRecipe && step === 4 && <button class="btn small" onClick={() => { setStep(3); scrollTo(0, 0); }}>הקודם</button>}
    </main>
  );
}

/** "2 כיכרות + 12 לחמניות" */
const describe = (items: Item[]): string =>
  items.map((i) => i.type === 'loaf' ? loafHe(i.count) : i.type === 'rolls' ? rollsHe(i.count) : `${i.count} ${i.name && i.type !== 'rolls' && i.type !== 'loaf' && i.type !== 'pizza' && i.type !== 'bagel' && i.type !== 'pan' ? i.name : (DEFAULT_ITEM_TYPES.find((t) => t.id === i.type)?.plural ?? i.name ?? '')}`).join(' + ');

const groupOf = (i: Item): 'loaf' | 'rolls' => DEFAULT_ITEM_TYPES.find((t) => t.id === i.type)?.group ?? 'rolls';

/** Recipes saved before items existed only know loaves and rolls. */
function itemsOf(r: Recipe): Item[] {
  if (r.items?.length) return r.items;
  const t = (id: string) => DEFAULT_ITEM_TYPES.find((x) => x.id === id)!;
  return [
    ...(r.loaves > 0 ? [{ ...itemFrom(t('loaf'), r.loaves), weight: r.weight }] : []),
    ...(r.rolls > 0 ? [itemFrom(t('rolls'), r.rolls)] : []),
  ];
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
