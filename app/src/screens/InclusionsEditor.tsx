import { useState } from 'preact/hooks';
import { setState, useStore, type InclusionDef } from '../store';

export function InclusionsEditor() {
  const { inclusions } = useStore();
  const [name, setName] = useState('');
  const [pct, setPct] = useState(15);
  const [soak, setSoak] = useState(false);
  const patch = (id: string, p: Partial<InclusionDef>) => setState({ inclusions: inclusions.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  return (
    <details>
      <summary>ניהול תוספות</summary>
      {inclusions.map((i) => (
        <div class="row" data-testid="incl-row" style="flex-wrap:wrap;gap:6px">
          <input style="min-width:0;width:110px" aria-label={`שם ${i.name}`} value={i.name} onInput={(e) => patch(i.id, { name: e.currentTarget.value })} />
          <input aria-label={`כמות ${i.name}`} type="number" min="1" max="60" style="width:60px" value={Math.round(i.pct * 100)} onInput={(e) => patch(i.id, { pct: Math.min(60, Math.max(1, +e.currentTarget.value || 1)) / 100 })} />
          <span class="muted">% מהקמח</span>
          <label class="muted"><input type="checkbox" checked={i.soak} onChange={(e) => patch(i.id, { soak: e.currentTarget.checked })} /> להשרות</label>
          <button class="btn small" aria-label={`מחק ${i.name}`} onClick={() => setState({ inclusions: inclusions.filter((x) => x.id !== i.id) })}>×</button>
        </div>
      ))}
      <div class="row" style="flex-wrap:wrap;gap:6px">
        <input style="min-width:0;width:110px" aria-label="שם תוספת חדשה" placeholder="תוספת חדשה" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <input aria-label="כמות לתוספת חדשה" type="number" style="width:60px" value={pct} onInput={(e) => setPct(+e.currentTarget.value || 1)} />
        <span class="muted">%</span>
        <label class="muted"><input type="checkbox" checked={soak} onChange={(e) => setSoak(e.currentTarget.checked)} /> להשרות</label>
        <button class="btn small" disabled={!name.trim()} onClick={() => {
          setState({ inclusions: [...inclusions, { id: `i${Date.now()}`, name: name.trim(), pct: pct / 100, soak }] });
          setName('');
        }}>הוסף</button>
      </div>
    </details>
  );
}
