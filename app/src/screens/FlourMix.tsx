import { useState } from 'preact/hooks';
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

export function FlourMix({ items, onChange }: { items: MixItem[]; onChange: (items: MixItem[]) => void }) {
  const st = useStore();
  const [name, setName] = useState('');
  const [newFlour, setNewFlour] = useState('');
  const [newAbs, setNewAbs] = useState(0);
  const flours = allFlours();
  const total = items.reduce((s, i) => s + i.grams, 0);
  const set = (k: number, patch: Partial<MixItem>) => onChange(items.map((it, j) => (j === k ? { ...it, ...patch } : it)));
  const setPct = (k: number, pct: number) => {
    // keep the total, move this flour's share
    const t = total || 1000;
    set(k, { grams: Math.round((t * Math.min(100, Math.max(0, pct))) / 100) });
  };
  const savePreset = () => {
    const n = name.trim();
    if (!n) return;
    setState({ flourPresets: [...st.flourPresets, { id: String(Date.now()), name: n, items }] });
    setName('');
  };

  return (
    <section class="card" aria-label="הרכב הקמחים">
      <strong>הרכב הקמחים שלי</strong>
      {st.flourPresets.length > 0 && (
        <div class="chips">
          {st.flourPresets.map((p: FlourPreset) => (
            <span class="chip-wrap" style="display:inline-flex;gap:2px">
              <button class="chip" onClick={() => onChange(p.items)}>{p.name}</button>
              <button class="chip" aria-label={`מחק את ${p.name}`} onClick={() => setState({ flourPresets: st.flourPresets.filter((x) => x.id !== p.id) })}>×</button>
            </span>
          ))}
        </div>
      )}
      {items.map((it, k) => (
        <div class="row" data-testid="mix-row" style="flex-wrap:wrap;gap:6px">
          <select aria-label="סוג קמח" value={it.flour} onChange={(e) => set(k, { flour: e.currentTarget.value })}>
            {flours.map((f) => <option value={f.id}>{f.name}</option>)}
          </select>
          <input aria-label="גרמים" type="number" inputMode="numeric" min="0" style="width:72px" value={it.grams} onInput={(e) => set(k, { grams: Math.max(0, +e.currentTarget.value || 0) })} />
          <span class="muted">ג'</span>
          <input aria-label="אחוז" type="number" inputMode="numeric" min="0" max="100" style="width:60px" value={total ? Math.round((it.grams / total) * 100) : 0} onInput={(e) => setPct(k, +e.currentTarget.value || 0)} />
          <span class="muted">%</span>
          <button class="btn small" aria-label="הסר קמח" onClick={() => onChange(items.filter((_, j) => j !== k))} disabled={items.length === 1}>×</button>
        </div>
      ))}
      <div class="row">
        <span class="muted">סה"כ <span class="num" data-testid="mix-total">{total}</span> ג'</span>
        <button class="btn small" onClick={() => onChange([...items, { flour: 'white', grams: 100 }])}>+ הוסף קמח</button>
      </div>
      <div class="row">
        <input aria-label="שם לתמהיל" placeholder="שם לשמירה" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <button class="btn small" onClick={savePreset} disabled={!name.trim()}>שמור תמהיל</button>
      </div>
      <details>
        <summary>קמח משלי</summary>
        {st.customFlours.map((f) => (
          <div class="row">
            <span>{f.name} <span class="muted">({f.absorption >= 0 ? '+' : ''}{Math.round(f.absorption * 100)} נק' מים)</span></span>
            <button class="btn small" aria-label={`מחק את ${f.name}`} onClick={() => setState({ customFlours: st.customFlours.filter((x) => x.id !== f.id) })}>×</button>
          </div>
        ))}
        <div class="row">
          <input aria-label="שם קמח חדש" placeholder="שם הקמח" value={newFlour} onInput={(e) => setNewFlour(e.currentTarget.value)} />
          <input aria-label="ספיגת מים" type="number" style="width:64px" value={newAbs} onInput={(e) => setNewAbs(+e.currentTarget.value || 0)} />
          <span class="muted">נק' מים מול לבן</span>
          <button class="btn small" disabled={!newFlour.trim()} onClick={() => {
            setState({ customFlours: [...st.customFlours, { id: `c${Date.now()}`, name: newFlour.trim(), absorption: newAbs / 100 }] });
            setNewFlour(''); setNewAbs(0);
          }}>הוסף</button>
        </div>
      </details>
    </section>
  );
}
