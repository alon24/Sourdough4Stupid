import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addCustom, addLoaf, setMethod, setWhereAll, branchSummary, removeBranch, removeStep, setRollCount, setTrackAlarms, setUserNote, setWeight, setWhere, type Branch, type Where,
  addFold, removeFold, setAutolyse, bulkState, complete, doughTempAdvice, FRICTION, resumeAt, retimeBulk, roomTempTip, setAlarm, shift, TARGET_DOUGH_C,
  waterTemp, fridgeTip, targetFor, type Reading, type Step,
} from '../../../core/src/index';
import { dayName, grams, hhmm, toLocalInput, until } from '../format';
import { getState, planId, selectPlan, setState, useStore, type PlanPhoto } from '../store';
import { savePhoto, shrink, usePhotoUrl } from '../photos';

export function PlanScreen() {
  const { plan, history, others } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [cascade, setCascade] = useState(true);
  const [doneAtInput, setDoneAtInput] = useState('');
  const [derive, setDerive] = useState<boolean | null>(null);
  const [deriveP, setDeriveP] = useState(false);
  const [branchOpen, setBranchOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [fromHere, setFromHere] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const nextRef = useRef<HTMLElement | null>(null);
  const [far, setFar] = useState(false);
  useEffect(() => {
    const el = nextRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setFar(false); return; }
    const io = new IntersectionObserver(([e]) => setFar(!e!.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  });

  if (!plan) {
    return (
      <main>
        <h1>אין תוכנית פעילה</h1>
        <p class="muted">מתחילים אפייה חדשה, והשלבים יופיעו כאן עם שעות.</p>
        <a class="btn primary" href="#/new" style="display:flex;align-items:center;justify-content:center;text-decoration:none">אפייה חדשה</a>
      </main>
    );
  }

  const steps = plan.steps;
  const next = steps.find((s) => s.doneAt === undefined);
  const last = steps[steps.length - 1]!;
  const sel = steps.find((s) => s.id === open);
  const update = (s: Step[]) => {
    setState({ plan: { ...getState().plan!, steps: s, undo: steps } });
    setOpen(null);
  };
  const mixStep = steps.find((s) => s.kind === 'mix');
  const hasAutolyse = steps.some((s) => s.kind === 'autolyse');
  const toggleAutolyse = (on: boolean) => {
    update(setAutolyse(steps, on, Date.now(), plan.kneading === 'machine' ? 30 : 45));
    setState({ plan: { ...getState().plan!, input: plan.input ? { ...plan.input, autolyse: on } : plan.input } });
    if (plan.recipeId) setDerive(on);
  };
  const deriveRecipe = () => {
    const st = getState();
    const base = st.recipes.find((r) => r.id === plan.recipeId);
    if (base) setState({ recipes: [...st.recipes, { ...base, id: `r${Date.now()}`, name: `${base.name} (${derive ? 'עם' : 'בלי'} אוטוליזה)`, fav: false, derivedFrom: base.id, autolyse: !!derive }] });
    setDerive(null);
  };
  const branches = plan.branches ?? [];
  const total = plan.total ?? 0;
  const applyB = (r: { steps: Step[]; branches: Branch[] }, pieces = false) => {
    setState({ plan: { ...getState().plan!, steps: r.steps, branches: r.branches, undo: steps } });
    if (pieces && plan.recipeId) setDeriveP(true);
  };
  const sheetB = branches.find((b) => b.id === branchOpen);
  const allRoom = branches.length > 0 && branches.every((b) => b.where === 'room' || b.where === 'now');
  const finish = () => {
    const notes = [
      ...branches.filter((b) => b.note).map((b) => `${b.label}: ${b.note}`),
      ...steps.filter((s) => s.userNote).map((s) => `${s.title}: ${s.userNote}`),
      ...steps.filter((s) => s.kind === 'custom').map((s) => `${s.title}${s.note ? `: ${s.note}` : ''}`),
    ];
    setState({ plan: null, history: [{ title: plan.title, finishedAt: Date.now(), ...(notes.length ? { notes } : {}), ...(plan.photos?.length ? { photos: plan.photos } : {}), ...(plan.readings?.length ? { readings: plan.readings } : {}) }, ...history] });
  };
  const deriveFromPieces = () => {
    const st = getState();
    const base = st.recipes.find((r) => r.id === plan.recipeId);
    const lo = branches.filter((b) => b.kind === 'loaf');
    const ro = branches.find((b) => b.kind === 'rolls');
    if (base) setState({ recipes: [...st.recipes, { ...base, id: `r${Date.now()}`, name: `${base.name} (גרסה)`, fav: false, derivedFrom: base.id, loaves: lo.length, rolls: ro?.count ?? 0, weight: Math.round(lo[0]?.weight ?? base.weight) }] });
    setDeriveP(false);
  };
  const askNotify = () => 'Notification' in window && Notification.requestPermission();

  let prevDay = '';
  return (
    <main>
      <div>
        <span class="sub">{plan.title}</span>
        <h1>התוכנית שלך</h1>
      </div>
      {others.length > 0 && (
        <nav class="chips" aria-label="אפיות רצות" data-testid="bake-switch">
          {[plan, ...others].map((p) => (
            <button class={`chip ${p === plan ? 'on' : ''}`} aria-pressed={p === plan} onClick={() => selectPlan(planId(p))}>{p.title}</button>
          ))}
          <a class="chip" href="#/new">+ אפייה נוספת</a>
        </nav>
      )}

      <section class="card mint">
        <div class="row">
          <strong>
            מסיימים {dayName(last.at)} ב־<span class="num" data-testid="finish">{hhmm(last.at)}</span>
          </strong>
          {plan.undo && (
            <button class="btn small" onClick={() => setState({ plan: { ...plan, steps: plan.undo!, undo: undefined } })}>בטל שינוי</button>
          )}
        </div>
      </section>

      <details class="card">
        <summary style="font-weight:700;cursor:pointer;min-height:32px">כמויות</summary>
        <table class="amounts">
          <tbody>
            {plan.amounts.map((a) => (
              <tr><td>{a.name}</td><td>{grams(a.grams)}</td></tr>
            ))}
          </tbody>
        </table>
        <span class="muted">האכלת הסטארטר: {plan.build}</span>
      </details>

      {plan.input && !steps.some((s) => s.doneAt !== undefined) && (
        <a class="btn primary" href="#/start">התחלת ביצוע: איפה אני?</a>
      )}

      {branches.length > 0 && (
        <section class="card" aria-label="מתי אופים" data-testid="when-card">
          <strong>מתי אופים?</strong>
          <div class="seg" role="group" aria-label="מתי אופים">
            <button class={!allRoom ? 'on' : ''} aria-pressed={!allRoom} onClick={() => applyB(setWhereAll(steps, branches, 'fridge', Date.now(), getState().roomTempC))}>לילה במקרר</button>
            <button class={allRoom ? 'on' : ''} aria-pressed={allRoom} onClick={() => applyB(setWhereAll(steps, branches, 'room', Date.now(), getState().roomTempC))}>אפייה באותו יום</button>
          </div>
          <span class="muted">{allRoom ? 'אחרי העיצוב מתפיחים בחוץ ואופים היום. השעות והשעונים מתעדכנים.' : 'אחרי העיצוב למקרר, ואופים לפי השעה בתוכנית.'}</span>
        </section>
      )}

      {mixStep && mixStep.doneAt === undefined && (
        <section class="card" aria-label="אוטוליזה">
          <div class="row">
            <strong>אוטוליזה</strong>
            <button class="btn small" onClick={() => toggleAutolyse(!hasAutolyse)}>
              {hasAutolyse ? 'בלי אוטוליזה, הכול יחד' : 'להוסיף אוטוליזה'}
            </button>
          </div>
          <span class="muted">{hasAutolyse ? 'קמח ומים נחים לפני הערבוב.' : 'הכול נכנס יחד: לישה 6–8 דק\' ו־30 דק\' מנוחה לפני הקיפול הראשון.'}</span>
          {derive !== null && (
            <div role="alert" class="grid2">
              <strong style="grid-column:1/-1">לשמור את השינוי כמתכון חדש?</strong>
              <button class="btn primary small" onClick={deriveRecipe}>כן, מתכון חדש</button>
              <button class="btn small" onClick={() => setDerive(null)}>לא, רק הפעם</button>
            </div>
          )}
        </section>
      )}

      <div class="grid2 actions">
        <button class="btn" data-testid="open-temp" onClick={() => { setTempOpen(true); setTimeout(() => document.getElementById('temp-card')?.scrollIntoView({ block: 'center' }), 50); }}>🌡️ טמפרטורה</button>
        <button class="btn" data-testid="open-photo" onClick={() => setPhotoOpen(true)}>📷 תמונה</button>
      </div>
      <TempCard open={tempOpen} stepKind={(next ?? last).kind} />
      <PhotoStrip photos={plan.photos ?? []} />

      {far && next && (
        <button class="btn small jump" onClick={() => nextRef.current?.scrollIntoView({ block: 'center' })}>לשלב הנוכחי</button>
      )}
      {deriveP && (
        <section class="card" role="alert">
          <strong>שינית את החלוקה. לשמור כמתכון חדש?</strong>
          <div class="grid2">
            <button class="btn primary small" onClick={deriveFromPieces}>כן, מתכון חדש</button>
            <button class="btn small" onClick={() => setDeriveP(false)}>לא, רק הפעם</button>
          </div>
        </section>
      )}
      <div class="steps">
        {steps.filter((s) => !s.track).map((s) => {
          const day = dayName(s.at);
          const header = day !== prevDay;
          prevDay = day;
          const cls = s.doneAt !== undefined ? 'done' : s.id === next?.id ? 'next' : '';
          return (
            <>
              {header && <span class="sub day">{day}</span>}
              <StepRow s={s} cls={cls} isNext={s.id === next?.id} onOpen={() => setOpen(s.id)} refEl={s.id === next?.id ? nextRef : undefined} />
              {s.kind === 'divide' && branches.length > 0 && (
                <section class="card sun split" aria-label="החלוקה" data-testid="split">
                  <span class="sub">✂️ כאן האפייה מתפצלת · {hhmm(s.at)}</span>
                  <strong class="big">{branchSummary(branches)}</strong>
                  <span class="muted">מכאן כל כיכר והלחמניות הן מסלול משלו: הערות, מקרר או אפייה עכשיו, משקל והתראות.</span>
                </section>
              )}
              {s.kind === 'divide' && branches.map((br) => {
                const ts = steps.filter((x) => x.track === br.id);
                const where = { plan: 'לפי התוכנית', fridge: 'במקרר', room: 'מתפיח בחוץ', now: 'נאפה עכשיו' }[br.where];
                return (
                  <section class="track" data-testid="track" aria-label={br.label}>
                    <div class="row">
                      <strong>{br.kind === 'rolls' ? '🥖' : '🍞'} {br.label} <span class="muted">· <span class="num">{br.count > 1 ? `${br.count} × ` : ''}{Math.round(br.weight)}</span> ג' · {where}</span></strong>
                      <button class="btn small" onClick={() => setBranchOpen(br.id)} aria-label={`ניהול ${br.label}`}>ניהול</button>
                    </div>
                    {br.note && <span class="note-user">📝 {br.note}</span>}
                    {ts.map((x) => (
                      <StepRow s={x} cls={x.doneAt !== undefined ? 'done' : x.id === next?.id ? 'next' : ''} isNext={x.id === next?.id} onOpen={() => setOpen(x.id)} refEl={x.id === next?.id ? nextRef : undefined} showDay />
                    ))}
                  </section>
                );
              })}
            </>
          );
        })}
      </div>
      <button class="btn small" onClick={() => setAdding(true)}>+ שלב או הערה חופשיים</button>

      <div class="grid2">
        <button class="btn small" onClick={askNotify}>הפעל התראות</button>
        <button class="btn small" onClick={finish}>{next ? 'בטל תוכנית' : 'סיימתי, לשמור ביומן'}</button>
      </div>

      {sel && (
        <>
          <button class="scrim" aria-label="סגור" onClick={() => setOpen(null)}></button>
          <div class="sheet" role="dialog" aria-label={sel.title}>
            <div class="row">
              <strong class="big">{sel.title}</strong>
              <span class="big num">{hhmm(sel.at)}</span>
            </div>
            {sel.note && <span class="muted">{sel.note}</span>}
            <label class="field">
              ההערה שלי
              <textarea rows={2} value={sel.userNote ?? ''} onInput={(e) => setState({ plan: { ...getState().plan!, steps: setUserNote(getState().plan!.steps, sel.id, e.currentTarget.value) } })}></textarea>
            </label>
            {sel.kind === 'custom' && <button class="btn small" onClick={() => update(removeStep(steps, sel.id))}>מחק שלב זה</button>}
            {(sel.kind === 'fold' || sel.kind === 'mix') && sel.doneAt === undefined && (
              <>
                <span class="sub">איך לשים עכשיו?</span>
                <div class="seg" role="group" aria-label="שיטת לישה">
                  {(['hand', 'machine'] as const).map((m) => (
                    <button class={(sel.method ?? plan.kneading) === m ? 'on' : ''} aria-pressed={(sel.method ?? plan.kneading) === m} onClick={() => update(setMethod(steps, sel.id, m, fromHere))}>
                      {m === 'hand' ? 'ביד' : 'מכונה'}
                    </button>
                  ))}
                </div>
                {sel.kind === 'fold' && (
                  <label class="row" style="justify-content:flex-start;min-height:44px">
                    <input type="checkbox" checked={fromHere} onChange={(e) => setFromHere(e.currentTarget.checked)} style="width:24px;height:24px" />
                    גם לכל הקיפולים הבאים
                  </label>
                )}
              </>
            )}
            {sel.kind === 'fold' && sel.doneAt === undefined && (
              <div class="grid2">
                <button class="btn small" onClick={() => update(addFold(steps, plan.input?.foldGapMin ?? 30))}>הוסף קיפול</button>
                <button class="btn small" onClick={() => update(removeFold(steps, sel.id))}>הסר קיפול זה</button>
              </div>
            )}
            {sel.doneAt === undefined ? (
              <>
                <div class="grid3">
                  {[-15, 15, 30, 60].slice(0, 3).map((m) => (
                    <button class="btn small" onClick={() => update(shift(steps, sel.id, m, cascade))}>
                      <span class="num">{m > 0 ? `+${m}` : m}</span> דק'
                    </button>
                  ))}
                </div>
                <label class="row" style="justify-content:flex-start;min-height:48px">
                  <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.currentTarget.checked)} style="width:24px;height:24px" />
                  להזיז גם את כל השלבים שאחריו
                </label>
                <label class="row" style="justify-content:flex-start;min-height:48px">
                  <input type="checkbox" checked={sel.alarm} onChange={(e) => update(setAlarm(steps, sel.id, e.currentTarget.checked))} style="width:24px;height:24px" />
                  שעון מעורר לשלב הזה
                </label>
                <label class="field">
                  בוצע בשעה (אם כבר עשית)
                  <input
                    type="time"
                    value={doneAtInput}
                    onInput={(e) => setDoneAtInput(e.currentTarget.value)}
                  />
                </label>
                {doneAtInput && (
                  <button class="btn small" onClick={() => {
                    const [h, m] = doneAtInput.split(':').map(Number);
                    const d = new Date(sel.at);
                    d.setHours(h ?? 0, m ?? 0, 0, 0);
                    // a time earlier than the step belongs to the same day; a late-night step may roll over
                    if (d.getTime() < sel.at - 12 * 3_600_000) d.setDate(d.getDate() + 1);
                    setDoneAtInput('');
                    update(complete(steps, sel.id, d.getTime()));
                  }}>
                    סמן שבוצע ב־<span class="num">{doneAtInput}</span>
                  </button>
                )}
                <div class="grid2">
                  <button class="btn" onClick={() => update(resumeAt(steps, sel.id, Date.now()))}>אני כאן עכשיו</button>
                  <button class="btn primary" onClick={() => update(complete(steps, sel.id, Date.now()))}>בוצע</button>
                </div>
              </>
            ) : (
              <span class="muted">בוצע ב־<span class="num">{hhmm(sel.doneAt)}</span></span>
            )}
          </div>
        </>
      )}
      {sheetB && (
        <>
          <button class="scrim" aria-label="סגור" onClick={() => setBranchOpen(null)}></button>
          <div class="sheet" role="dialog" aria-label={`ניהול ${sheetB.label}`}>
            <div class="row">
              <strong class="big">{sheetB.label}</strong>
              <button class="btn small" onClick={() => setBranchOpen(null)}>סגור</button>
            </div>
            <span class="sub">איפה זה עכשיו?</span>
            <div class="grid2">
              {([['plan', 'לפי התוכנית'], ['fridge', 'למקרר'], ['room', 'מתפיח בחוץ'], ['now', 'לאפות עכשיו']] as [Where, string][]).map(([w, label]) => (
                <button class={`btn small ${sheetB.where === w ? 'primary' : ''}`} aria-pressed={sheetB.where === w} onClick={() => applyB(setWhere(steps, branches, sheetB.id, w, Date.now(), getState().roomTempC))}>{label}</button>
              ))}
            </div>
            {sheetB.kind === 'loaf' ? (
              <div class="row">
                <span>משקל כיכר</span>
                <span class="stepper">
                  <button aria-label="פחות משקל" onClick={() => applyB(setWeight(steps, branches, sheetB.id, Math.max(100, sheetB.weight - 50), total), true)}>−</button>
                  <b class="num">{Math.round(sheetB.weight)}</b> ג'
                  <button class="plus" aria-label="יותר משקל" onClick={() => applyB(setWeight(steps, branches, sheetB.id, sheetB.weight + 50, total), true)}>+</button>
                </span>
              </div>
            ) : (
              <div class="row">
                <span>כמה לחמניות ({Math.round(sheetB.weight)} ג' כל אחת)</span>
                <span class="stepper">
                  <button aria-label="פחות לחמניות" onClick={() => applyB(setRollCount(steps, branches, sheetB.count - 1, total), true)}>−</button>
                  <b class="num">{sheetB.count}</b>
                  <button class="plus" aria-label="יותר לחמניות" onClick={() => applyB(setRollCount(steps, branches, sheetB.count + 1, total), true)}>+</button>
                </span>
              </div>
            )}
            <label class="field">
              הערה למסלול הזה
              <textarea rows={2} value={sheetB.note} onInput={(e) => setState({ plan: { ...getState().plan!, branches: getState().plan!.branches!.map((x) => (x.id === sheetB.id ? { ...x, note: e.currentTarget.value } : x)) } })}></textarea>
            </label>
            <label class="row" style="justify-content:flex-start;min-height:48px">
              <input type="checkbox" checked={steps.filter((x) => x.track === sheetB.id && x.doneAt === undefined).some((x) => x.alarm)} onChange={(e) => update(setTrackAlarms(steps, sheetB.id, e.currentTarget.checked))} style="width:24px;height:24px" />
              שעוני מעורר לשלבי המסלול
            </label>
            <div class="grid2">
              <button class="btn small" onClick={() => { setAdding(true); }}>+ שלב למסלול</button>
              {sheetB.kind === 'loaf' ? (
                <button class="btn small" onClick={() => { applyB(removeBranch(steps, branches, sheetB.id, total), true); setBranchOpen(null); }}>הסר כיכר</button>
              ) : <span></span>}
            </div>
            {sheetB.kind === 'loaf' && <button class="btn small" onClick={() => applyB(addLoaf(steps, branches, total), true)}>+ עוד כיכר</button>}
          </div>
        </>
      )}

      {photoOpen && <PhotoSheet stepTitle={(next ?? last).title} stepId={(next ?? last).id} hasBulk={!!plan.bulk} onClose={() => setPhotoOpen(false)} />}
      {adding && <AddStep branches={branches} track={branchOpen ?? ''} onClose={() => setAdding(false)} onAdd={(c) => { update(addCustom(steps, c)); setAdding(false); }} />}
    </main>
  );
}

function StepRow({ s, cls, isNext, onOpen, refEl, showDay }: { s: Step; cls: string; isNext: boolean; onOpen: () => void; refEl?: { current: HTMLElement | null }; showDay?: boolean }) {
  return (
    <button class={`step ${cls}`} onClick={onOpen} aria-label={`${s.title}, ${hhmm(s.at)}`} ref={(el) => { if (refEl) refEl.current = el; }}>
      <span class="t num">{hhmm(s.at)}{showDay ? <small class="d">{dayName(s.at)}</small> : null}</span>
      <span class="dot" aria-hidden="true"></span>
      <span>
        <span class="title">{s.title}{s.alarm && s.doneAt === undefined ? ' ⏰' : ''}</span>
        {isNext && <span class="note">{until(s.at)}</span>}
        {s.note && s.doneAt === undefined && <span class="note">{s.note}</span>}
        {s.userNote && <span class="note note-user">📝 {s.userNote}</span>}
      </span>
    </button>
  );
}

function AddStep({ branches, track, onClose, onAdd }: { branches: Branch[]; track: string; onClose: () => void; onAdd: (c: { title: string; at: number; note?: string; track?: string; alarm?: boolean }) => void }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(toLocalInput(Date.now() + 15 * 60_000).slice(11, 16));
  const [tr, setTr] = useState(track);
  const [alarm, setAlarmOn] = useState(false);
  const go = () => {
    if (!title.trim()) return;
    const [h, m] = time.split(':').map(Number);
    const d = new Date(); d.setHours(h ?? 0, m ?? 0, 0, 0);
    if (d.getTime() < Date.now() - 12 * 3_600_000) d.setDate(d.getDate() + 1);
    onAdd({ title: title.trim(), at: d.getTime(), track: tr || undefined, alarm });
  };
  return (
    <>
      <button class="scrim" aria-label="סגור" onClick={onClose}></button>
      <div class="sheet" role="dialog" aria-label="שלב או הערה חדשים">
        <strong class="big">שלב או הערה חדשים</strong>
        <label class="field">מה? <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="למשל: לבדוק את הכיכר במקרר" /></label>
        <label class="field">מתי? <input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></label>
        <label class="field">
          למסלול
          <select value={tr} onChange={(e) => setTr(e.currentTarget.value)}>
            <option value="">כללי</option>
            {branches.map((b) => <option value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label class="row" style="justify-content:flex-start;min-height:48px">
          <input type="checkbox" checked={alarm} onChange={(e) => setAlarmOn(e.currentTarget.checked)} style="width:24px;height:24px" />
          שעון מעורר
        </label>
        <button class="btn primary" onClick={go}>הוסף</button>
      </div>
    </>
  );
}

/** Quick temperature input: dough, kitchen, rise. Recomputes the rest of the bulk and the alarms. */
function TempCard({ open, stepKind }: { open: boolean; stepKind: string }) {
  const { plan, roomTempC } = useStore();
  const [dough, setDough] = useState('');
  const [room, setRoom] = useState(String(roomTempC));
  const [rise, setRise] = useState('');
  const [fridge, setFridge] = useState('');
  if (!plan) return null;
  const bulk = plan.bulk;
  const readings: Reading[] = plan.readings ?? [];
  const now = Date.now();
  const started = !!bulk && now >= bulk.startAt;
  const st = bulk ? bulkState(readings, now, bulk) : { progress: 0, remainingMin: 0, tempC: roomTempC };
  const lastDough = [...readings].reverse().find((r) => r.doughC !== undefined)?.doughC;
  const roomNum = Number(room) || roomTempC;
  const water = waterTemp({
    desired: TARGET_DOUGH_C.bread, flour: roomNum, room: roomNum, levain: roomNum,
    friction: FRICTION[plan.kneading ?? 'hand'],
  });
  const left = Math.round(st.remainingMin);

  const apply = () => {
    const r: Reading = { at: Date.now() };
    if (dough !== '' && !Number.isNaN(Number(dough))) r.doughC = Number(dough);
    if (room !== '' && !Number.isNaN(Number(room))) r.roomC = Number(room);
    if (rise !== '' && !Number.isNaN(Number(rise))) r.risePct = Number(rise);
    if (fridge !== '' && !Number.isNaN(Number(fridge))) r.fridgeC = Number(fridge);
    const next = [...readings, r];
    const steps = bulk ? retimeBulk(plan.steps, bulk, next, r.at) : plan.steps;
    setState({ plan: { ...getState().plan!, readings: next, steps, undo: steps === plan.steps ? plan.undo : plan.steps } });
    setDough('');
    setRise('');
    setFridge('');
  };

  return (
    <section class={`card ${open ? 'hl' : ''}`} id="temp-card" aria-label="טמפרטורות">
      <strong>טמפרטורות</strong>
      <span class="muted" data-testid="temp-target">יעד עכשיו ({targetFor(stepKind, roomNum).what}): {targetFor(stepKind, roomNum).text}</span>
      {!started && (
        <span class="muted" data-testid="water-tip">
          לבצק בטמפרטורת <span class="num">{TARGET_DOUGH_C.bread}°</span> השתמש במים בכ־<span class="num">{Math.round(water)}°</span>
          {plan.kneading === 'machine' ? ' (מכונה מחממת את הבצק)' : ''}.
        </span>
      )}
      {started && (
        <>
          <div class="row">
            <span>
              {left === 0 ? 'ההתפחה אמורה להסתיים, בדוק את הבצק' : <>נשארו בערך <span class="num" data-testid="bulk-left">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span> ש' להתפחה</>}
            </span>
            <span class="tag">{Math.round(st.progress * 100)}%</span>
          </div>
          <progress max={100} value={Math.round(st.progress * 100)} aria-label="התקדמות ההתפחה" style="width:100%"></progress>
        </>
      )}
      <div class="grid2">
        <label class="field">
          בצק °C
          <input type="number" inputMode="decimal" value={dough} placeholder="26" onInput={(e) => setDough(e.currentTarget.value)} />
        </label>
        <label class="field">
          מטבח °C
          <input type="number" inputMode="decimal" value={room} onInput={(e) => setRoom(e.currentTarget.value)} />
        </label>
        <label class="field">
          מקרר °C
          <input type="number" inputMode="decimal" value={fridge} placeholder="4" onInput={(e) => setFridge(e.currentTarget.value)} />
        </label>
        <label class="field">
          עלייה %
          <input type="number" inputMode="decimal" value={rise} placeholder="40" onInput={(e) => setRise(e.currentTarget.value)} />
        </label>
      </div>
      <button class="btn small" onClick={apply}>עדכן את הזמנים</button>
      {readings.some((x) => x.fridgeC !== undefined) && <span data-testid="fridge-advice">{fridgeTip([...readings].reverse().find((x) => x.fridgeC !== undefined)!.fridgeC!)}</span>}
      {lastDough !== undefined && <span data-testid="dough-advice">{doughTempAdvice(lastDough).text}</span>}
      <span class="muted">{roomTempTip(roomNum)}</span>
    </section>
  );
}

function PhotoStrip({ photos }: { photos: PlanPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <section class="card" aria-label="תמונות מהאפייה" data-testid="photos">
      <strong>תמונות ({photos.length})</strong>
      <div class="thumbs">
        {photos.map((p) => <Thumb p={p} />)}
      </div>
    </section>
  );
}

function Thumb({ p }: { p: PlanPhoto }) {
  const url = usePhotoUrl(p.id);
  return (
    <figure class="thumb">
      {url ? <a href={url} target="_blank" rel="noopener"><img src={url} alt={p.label} /></a> : <div class="ph"></div>}
      <figcaption>{p.label}{p.risePct !== undefined ? ` · עלייה ${p.risePct}%` : ''}<br /><span class="num">{hhmm(p.at)}</span></figcaption>
    </figure>
  );
}

function PhotoSheet({ stepTitle, stepId, hasBulk, onClose }: { stepTitle: string; stepId: string; hasBulk: boolean; onClose: () => void }) {
  const [label, setLabel] = useState(stepTitle);
  const [rise, setRise] = useState('');
  const [busy, setBusy] = useState(false);
  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const id = `ph${Date.now().toString(36)}`;
      await savePhoto(id, await shrink(file));
      const cur = getState().plan!;
      const at = Date.now();
      const photo: PlanPhoto = { id, at, label: label.trim() || stepTitle, stepId, ...(rise !== '' && !Number.isNaN(Number(rise)) ? { risePct: Number(rise) } : {}) };
      let steps = cur.steps;
      let readings = cur.readings ?? [];
      if (photo.risePct !== undefined) {
        readings = [...readings, { at, risePct: photo.risePct }];
        if (cur.bulk) steps = retimeBulk(steps, cur.bulk, readings, at);
      }
      setState({ plan: { ...cur, steps, readings, photos: [...(cur.photos ?? []), photo] } });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button class="scrim" aria-label="סגור" onClick={onClose}></button>
      <div class="sheet" role="dialog" aria-label="תמונה חדשה">
        <strong class="big">תמונה לאפייה</strong>
        <label class="field">מה בתמונה? <input value={label} onInput={(e) => setLabel(e.currentTarget.value)} /></label>
        {hasBulk && (
          <label class="field">
            כמה הבצק עלה? % (אם מדדת, מעדכן את זמני ההתפחה)
            <input type="number" inputMode="decimal" value={rise} placeholder="40" onInput={(e) => setRise(e.currentTarget.value)} />
          </label>
        )}
        <div class="grid2">
          <label class="btn primary" style="cursor:pointer">
            📷 צלם
            <input type="file" accept="image/*" capture="environment" aria-label="צלם תמונה" disabled={busy} style="position:absolute;opacity:0;width:1px;height:1px" onChange={onFile} />
          </label>
          <label class="btn" style="cursor:pointer">
            🖼️ מהגלריה
            <input type="file" accept="image/*" aria-label="בחר תמונה מהגלריה" disabled={busy} style="position:absolute;opacity:0;width:1px;height:1px" onChange={onFile} />
          </label>
        </div>
        {busy && <span class="muted" role="status">שומר…</span>}
      </div>
    </>
  );
}
