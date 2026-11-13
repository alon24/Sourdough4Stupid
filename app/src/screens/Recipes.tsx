import { useState } from 'preact/hooks';
import { fromCsv, fromJson, recipeHtml, toCsv, toJson } from '../../../core/src/index';
import { loavesText, rollsText } from '../format';
import { recipeSummary } from '../summary';
import { getState, setState, useStore } from '../store';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Recipes() {
  const { recipes, customFlours, inclusions, history } = useStore();
  const [msg, setMsg] = useState('');
  const pct = Object.fromEntries(inclusions.map((i) => [i.name, i.pct]));
  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const isJson = text.trimStart().startsWith('{');
      const bundle = isJson ? fromJson(text) : { recipes: fromCsv(text), customFlours: [] };
      const cur = getState();
      const key = (r: { name: string; mix: unknown }) => JSON.stringify([r.name, r.mix]);
      const have = new Set(cur.recipes.map(key));
      const fresh = bundle.recipes.filter((r) => !have.has(key(r))).map((r, i) => ({ ...r, id: `r${Date.now()}${i}`, derivedFrom: undefined }));
      const ids = new Set(cur.customFlours.map((f) => f.id));
      setState({ recipes: [...cur.recipes, ...fresh], customFlours: [...cur.customFlours, ...bundle.customFlours.filter((f) => !ids.has(f.id))] });
      setMsg(`יובאו ${fresh.length} מתכונים${bundle.recipes.length > fresh.length ? `, ${bundle.recipes.length - fresh.length} כבר היו` : ''}.`);
    } catch {
      setMsg('הקובץ לא נראה כמו קובץ מתכונים של האפליקציה.');
    }
  };
  const sorted = [...recipes].sort((a, b) => Number(b.fav) - Number(a.fav));
  const patch = (id: string, p: object) => setState({ recipes: recipes.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const [confirmId, setConfirmId] = useState('');
  return (
    <main>
      <div>
        <span class="sub">המתכונים שלי</span>
        <h1>מתכונים</h1>
        <span class="muted">{recipes.length > 0 ? `${recipes.length} מתכונים שמורים` : 'התבניות שממנן יוצאת כל אפייה'}</span>
      </div>
      <a class="btn primary" href="#/recipe">מתכון חדש</a>
      {sorted.length === 0 && <p class="muted">עוד אין מתכונים. מתכון הוא התבנית: כמה, קמחים, הידרציה ותוספות. כל אפייה חדשה יוצאת ממנו.</p>}
      {sorted.map((r) => (
        <section class="card" data-testid="recipe">
          <div class="row">
            <div>
              <strong>{r.name}</strong>
              <div class="muted">
                {[r.loaves > 0 && loavesText(r.loaves), r.rolls > 0 && rollsText(r.rolls), ...r.inclusions].filter(Boolean).join(' · ')}
              </div>
              <div class="summary" data-testid="recipe-summary">
                {recipeSummary(r, history).map((l) => <span>{l}</span>)}
              </div>
            </div>
            <button class="btn icon quiet" aria-label={r.fav ? `הסר ${r.name} ממועדפים` : `הוסף ${r.name} למועדפים`} onClick={() => patch(r.id, { fav: !r.fav })}>{r.fav ? '★' : '☆'}</button>
          </div>
          <a class="btn primary" href={`#/new/${r.id}`}>אפייה חדשה</a>
          {history.some((h) => h.recipeId === r.id) && <a class="btn small" href={`#/log?recipe=${r.id}`} data-testid="recipe-bakes">{history.filter((h) => h.recipeId === r.id).length} אפיות מהמתכון הזה ביומן</a>}
          <div class="grid2">
            <a class="btn small" href={`#/recipe/${r.id}`}>עריכה</a>
            <details class="more">
              <summary class="btn small">עוד</summary>
              <div class="menu">
                <button class="btn small" onClick={() => download(`${r.name}.html`, recipeHtml(r, pct), 'text/html;charset=utf-8')}>דף HTML לשיתוף</button>
                {confirmId === r.id ? (
                  <button class="btn small" aria-label={`אישור מחיקה של ${r.name}`} style="border-color:var(--coral);color:var(--coral)" onClick={() => { setConfirmId(''); setState({ recipes: recipes.filter((x) => x.id !== r.id) }); }}>בטוח? מחק</button>
                ) : (
                  <button class="btn small" aria-label={`מחק את ${r.name}`} onClick={() => setConfirmId(r.id)}>מחק מתכון</button>
                )}
              </div>
            </details>
          </div>
        </section>
      ))}
      <details class="card tools">
        <summary>ייבוא וייצוא</summary>
        <div class="grid2" style="margin-top:8px">
          <button class="btn small" disabled={recipes.length === 0} onClick={() => download('recipes.json', toJson(recipes, customFlours), 'application/json')}>ייצוא JSON</button>
          <button class="btn small" disabled={recipes.length === 0} onClick={() => download('recipes.csv', '\uFEFF' + toCsv(recipes), 'text/csv;charset=utf-8')}>ייצוא CSV</button>
        </div>
        <label class="btn small" style="cursor:pointer;margin-top:8px">
          ייבוא מקובץ (JSON או CSV)
          <input type="file" accept=".json,.csv,application/json,text/csv" aria-label="ייבוא מתכונים" style="position:absolute;opacity:0;width:1px;height:1px" onChange={onFile} />
        </label>
      </details>
      {msg && <span role="status" data-testid="import-msg">{msg}</span>}
    </main>
  );
}
