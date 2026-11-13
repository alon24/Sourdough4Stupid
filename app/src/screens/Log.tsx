import { useState } from 'preact/hooks';
import { setState, useStore, type BakeStatus, type HistoryEntry } from '../store';

export const STATUS_LABEL: Record<BakeStatus, string> = {
  success: 'הצליחה',
  failed: 'לא הצליחה',
  finished: 'הסתיימה',
  unfinished: 'לא הושלמה',
};

/** The bake log: every bake with how it went, its notes and what was added. Status, notes and deletion are editable. */
export function Log() {
  const { history, recipes } = useStore();
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const recipeId = q.get('recipe');
  const [filter, setFilter] = useState<BakeStatus | 'all'>('all');
  const [confirm, setConfirm] = useState<HistoryEntry | null>(null);
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const recipe = recipes.find((r) => r.id === recipeId);
  const rows = history.filter((h) => (!recipeId || h.recipeId === recipeId) && (filter === 'all' || (h.status ?? 'finished') === filter));
  const patch = (h: HistoryEntry, p: Partial<HistoryEntry>) => {
    const next = { ...h, ...p };
    setState({ history: history.map((x) => (x === h ? next : x)) });
    if (editing === h) setEditing(next);
  };
  return (
    <main>
      <div>
        <span class="sub">יומן אפיות</span>
        <h1>{recipe ? `אפיות של ${recipe.name}` : 'יומן אפיות'}</h1>
        <span class="muted">{history.length} אפיות ביומן. אפשר לשנות איך עברה, להוסיף הערה או למחוק.</span>
      </div>
      {recipeId && <a class="btn small" href="#/log">כל היומן</a>}
      <div class="chips" role="group" aria-label="סינון לפי סטטוס">
        {(['all', 'success', 'failed', 'finished', 'unfinished'] as const).map((s) => (
          <button class={`chip ${filter === s ? 'on' : ''}`} aria-pressed={filter === s} onClick={() => setFilter(s)}>{s === 'all' ? 'הכול' : STATUS_LABEL[s]}</button>
        ))}
      </div>
      {rows.length === 0 && <p class="muted" data-testid="log-empty">אין אפיות כאלה ביומן.</p>}
      {rows.map((h) => (
        <section class="card" data-testid="log-entry">
          <div class="row">
            <strong>{h.title}</strong>
            <span class="muted">{new Date(h.finishedAt).toLocaleDateString('he-IL')}</span>
          </div>
          <label class="field" style="flex-direction:row;align-items:center;gap:8px">
            איך עברה
            <select aria-label={`סטטוס ${h.title}`} value={h.status ?? 'finished'} onChange={(e) => patch(h, { status: e.currentTarget.value as BakeStatus })}>
              {(Object.keys(STATUS_LABEL) as BakeStatus[]).map((s) => <option value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          {h.inclusions?.length ? <span class="muted">תוספות באפייה הזאת: {h.inclusions.join(', ')}</span> : null}
          <span class="muted">
            {[h.photos?.length ? `${h.photos.length} תמונות` : '', h.readings?.length ? `${h.readings.length} מדידות טמפרטורה` : ''].filter(Boolean).join(' · ')}
          </span>
          {editing === h ? (
            <textarea rows={4} aria-label={`הערות ${h.title}`} value={(h.notes ?? []).join('\n')} onInput={(e) => patch(h, { notes: e.currentTarget.value.split('\n').filter((l) => l.trim()) })}></textarea>
          ) : (
            h.notes?.map((n) => <span class="tag">{n}</span>)
          )}
          <div class="grid2">
            <button class="btn small" onClick={() => setEditing(editing === h ? null : h)}>{editing === h ? 'סיום עריכה' : 'עריכת הערות'}</button>
            {confirm === h ? (
              <button class="btn small" aria-label={`אישור מחיקה של ${h.title}`} style="border-color:var(--coral);color:var(--coral)" onClick={() => { setConfirm(null); setState({ history: history.filter((x) => x !== h) }); }}>בטוח? מחק</button>
            ) : (
              <button class="btn small" aria-label={`מחק את ${h.title}`} onClick={() => setConfirm(h)}>מחק</button>
            )}
          </div>
          {h.recipeId && !recipeId && recipes.some((r) => r.id === h.recipeId) && <a class="btn small" href={`#/new/${h.recipeId}`}>לאפות שוב</a>}
        </section>
      ))}
    </main>
  );
}
