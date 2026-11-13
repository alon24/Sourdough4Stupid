import { useEffect, useState } from 'preact/hooks';
import { allFlours, type BlendShare } from '../../../core/src/index';
import { setState, useStore, type FlourPreset } from '../store';

export interface MixItem {
  flour: string;
  grams: number;
}

export const mixToBlend = (all: MixItem[]): BlendShare[] => {
  const known = new Set(allFlours().map((f) => f.id)); // a deleted custom flour may linger in an old preset
  const items = all.filter((i) => known.has(i.flour));
  const total = items.reduce((s, i) => s + i.grams, 0);
  return total > 0
    ? items.filter((i) => i.grams > 0).map((i) => ({ id: i.flour, pct: i.grams / total }))
    : [{ id: 'white', pct: 1 }];
};

const sum = (items: MixItem[]) => items.reduce((t, i) => t + i.grams, 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const parse = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
/** The shares add up to the whole when the grams add up to the base, give or take rounding. */
export const mixIsWhole = (items: MixItem[], base: number) => items.length > 0 && base > 0 && Math.abs(sum(items) - base) <= Math.max(1, base * 0.002);

/**
 * Grams and percent are two views of the same number: percent = grams / base, where base is the
 * total flour you are aiming for. Typing a percent sets that flour's grams and, with exactly two
 * flours, gives the other one the remainder. Typing grams moves only that flour. The mix is "whole"
 * (and can be used or saved) only when the shares total 100%.
 */
export function FlourMix({ items, onChange, onSaved, onValidity }: { items: MixItem[]; onChange: (items: MixItem[]) => void; onSaved?: (id: string) => void; onValidity?: (ok: boolean) => void }) {
  const st = useStore();
  const [name, setName] = useState('');
  const [newFlour, setNewFlour] = useState('');
  const [newAbs, setNewAbs] = useState(0);
  const [confirmDel, setConfirmDel] = useState('');
  const [base, setBase] = useState(() => sum(items) || 1000);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const flours = allFlours();
  const total = sum(items);
  const whole = mixIsWhole(items, base) && new Set(items.map((i) => i.flour)).size === items.length;
  const pctOf = (g: number) => (base > 0 ? (g / base) * 100 : 0);
  const pctTotal = r1(pctOf(total));
  const emit = (next: MixItem[]) => onChange(next);
  useEffect(() => { onValidity?.(whole); }, [whole]);
  const set = (k: number, patch: Partial<MixItem>) => emit(items.map((it, j) => (j === k ? { ...it, ...patch } : it)));
  const setGrams = (k: number, v: string) => {
    setDraft({ ...draft, [`g${k}`]: v });
    set(k, { grams: Math.max(0, Math.round(parse(v))) });
  };
  const setPct = (k: number, v: string) => {
    setDraft({ ...draft, [`p${k}`]: v });
    const g = Math.round((base * Math.min(100, Math.max(0, parse(v)))) / 100);
    emit(items.map((it, j) => (j === k ? { ...it, grams: g } : items.length === 2 ? { ...it, grams: Math.max(0, base - g) } : it)));
  };
  const setBaseTo = (v: string) => {
    setDraft({ ...draft, base: v });
    const nb = Math.max(1, Math.round(parse(v)));
    emit(items.map((it) => ({ ...it, grams: Math.round((it.grams * nb) / base) })));
    setBase(nb);
  };
  const blur = (key: string) => setDraft((d) => { const { [key]: _, ...rest } = d; return rest; });
  const used = new Set(items.map((i) => i.flour));
  const nextFlour = flours.find((f) => !used.has(f.id));
  const dupes = items.length !== used.size;
  const add = () => nextFlour && emit([...items, { flour: nextFlour.id, grams: Math.max(0, base - total) }]);
  const mergeDupes = () => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.flour, (m.get(i.flour) ?? 0) + i.grams);
    emit([...m].map(([flour, grams]) => ({ flour, grams })));
  };
  const savePreset = () => {
    const n = name.trim();
    if (!n) return;
    const id = String(Date.now());
    setState({ flourPresets: [...st.flourPresets, { id, name: n, items }] });
    setName('');
    onSaved?.(id);
  };

  return (
    <section class="card mixcard" aria-label="הרכב הקמחים">
      <div class="row">
        <strong>הרכב הקמחים שלי</strong>
        <label class="mixbase">
          <span class="muted">קמח כולל</span>
          <input aria-label="קמח כולל" type="text" inputMode="numeric" value={draft.base ?? base} onInput={(e) => setBaseTo(e.currentTarget.value)} onBlur={() => blur('base')} />
          <span class="muted">ג'</span>
        </label>
      </div>
      {st.flourPresets.length > 0 && (
        <div class="chips" aria-label="תמהילים שמורים" data-testid="presets">
          {st.flourPresets.map((p: FlourPreset) => (
            <span class="chipx">
              <button class="chipx-main" onClick={() => { setBase(sum(p.items) || 1000); setDraft({}); emit(p.items); }}>{p.name}</button>
              {confirmDel === p.id ? (
                <button class="chipx-del sure" aria-label={`אישור מחיקה של ${p.name}`} onClick={() => { setConfirmDel(''); setState({ flourPresets: st.flourPresets.filter((x) => x.id !== p.id) }); }}>מחק?</button>
              ) : (
                <button class="chipx-del" aria-label={`מחק את ${p.name}`} onClick={() => setConfirmDel(p.id)}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      <div class="mixhead" aria-hidden="true"><span>קמח</span><span>%</span><span>גרם</span><span></span></div>
      {items.map((it, k) => (
        <div class="mixrow" data-testid="mix-row">
          <select aria-label="סוג קמח" value={it.flour} onChange={(e) => set(k, { flour: e.currentTarget.value })}>
            {flours.map((f) => <option value={f.id} disabled={f.id !== it.flour && items.some((o, j) => j !== k && o.flour === f.id)}>{f.name}</option>)}
          </select>
          <input aria-label="אחוז" type="text" inputMode="decimal" value={draft[`p${k}`] ?? r1(pctOf(it.grams))} onInput={(e) => setPct(k, e.currentTarget.value)} onBlur={() => blur(`p${k}`)} />
          <input aria-label="גרמים" type="text" inputMode="numeric" value={draft[`g${k}`] ?? it.grams} onInput={(e) => setGrams(k, e.currentTarget.value)} onBlur={() => blur(`g${k}`)} />
          <button class="btn icon quiet" aria-label="הסר קמח" onClick={() => emit(items.filter((_, j) => j !== k))} disabled={items.length === 1}>×</button>
        </div>
      ))}
      <div class="mixtotal">
        <span data-testid="mix-status" role="status" style={`font-weight:700;color:${whole ? 'inherit' : 'var(--coral)'}`}>
          {whole ? 'סה"כ 100% ✓' : pctTotal < 100 ? <>סה"כ <span class="num" data-testid="mix-pct">{pctTotal}</span>%, חסרים <span class="num" data-testid="mix-left">{r1(100 - pctTotal)}</span>%</> : <>סה"כ <span class="num" data-testid="mix-pct">{pctTotal}</span>%, יותר מדי ב־<span class="num" data-testid="mix-left">{r1(pctTotal - 100)}</span>%</>}
          <span class="muted" style="font-weight:400"> · <span class="num" data-testid="mix-total">{total}</span> ג'</span>
        </span>
        <button class="btn small" onClick={add} disabled={!nextFlour}>+ הוסף קמח</button>
      </div>
      {dupes && (
        <div role="alert" data-testid="mix-dupes" class="warn">
          <span>אותו קמח מופיע יותר מפעם אחת. קמח יכול להופיע רק פעם אחת בתערובת.</span>
          <button class="btn small" onClick={mergeDupes}>אחד את השורות</button>
        </div>
      )}
      <div class="mixsave">
        <input aria-label="שם לתמהיל" placeholder="שם לשמירה" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <button class="btn small" onClick={savePreset} disabled={!name.trim() || !whole}>שמור תמהיל</button>
      </div>
      <span class="muted" style="font-size:13px">אפשר לערוך אחוזים או גרמים והשני מתעדכן. לשמירה צריך 100%.</span>
      <details>
        <summary>קמח משלי</summary>
        {st.customFlours.map((f) => (
          <div class="row customrow">
            <span>{f.name} <span class="muted">({f.absorption >= 0 ? '+' : ''}{Math.round(f.absorption * 100)} נק' מים)</span></span>
            <button class="btn small" aria-label={`מחק את ${f.name}`} onClick={() => setState({ customFlours: st.customFlours.filter((x) => x.id !== f.id) })}>×</button>
          </div>
        ))}
        <div class="customadd">
          <input aria-label="שם קמח חדש" placeholder="שם הקמח" style="grid-column:1/-1" value={newFlour} onInput={(e) => setNewFlour(e.currentTarget.value)} />
          <label class="absfield">
            <span class="muted">נק' מים מול לבן</span>
            <input aria-label="ספיגת מים" type="number" value={newAbs} onInput={(e) => setNewAbs(+e.currentTarget.value || 0)} />
          </label>
          <button class="btn small" disabled={!newFlour.trim()} onClick={() => {
            setState({ customFlours: [...st.customFlours, { id: `c${Date.now()}`, name: newFlour.trim(), absorption: newAbs / 100 }] });
            setNewFlour(''); setNewAbs(0);
          }}>הוסף</button>
        </div>
      </details>
    </section>
  );
}
