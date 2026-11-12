import { useState } from 'preact/hooks';
import { fromCsv, fromJson, recipeHtml, toCsv, toJson } from '../../../core/src/index';
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
  const { recipes, customFlours, inclusions } = useStore();
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
  return (
    <main>
      <div>
        <span class="sub">המתכונים שלי</span>
        <h1>מתכונים</h1>
      </div>
      <a class="btn primary" href="#/recipe" style="display:flex;justify-content:center;text-decoration:none">מתכון חדש</a>
      <section class="card" aria-label="ייצוא וייבוא">
        <div class="grid2">
          <button class="btn small" disabled={recipes.length === 0} onClick={() => download('recipes.json', toJson(recipes, customFlours), 'application/json')}>ייצוא JSON</button>
          <button class="btn small" disabled={recipes.length === 0} onClick={() => download('recipes.csv', '\uFEFF' + toCsv(recipes), 'text/csv;charset=utf-8')}>ייצוא CSV</button>
        </div>
        <label class="btn small" style="display:flex;justify-content:center;cursor:pointer">
          ייבוא מקובץ (JSON או CSV)
          <input type="file" accept=".json,.csv,application/json,text/csv" aria-label="ייבוא מתכונים" style="position:absolute;opacity:0;width:1px;height:1px" onChange={onFile} />
        </label>
        {msg && <span role="status" data-testid="import-msg">{msg}</span>}
      </section>
      {sorted.length === 0 && <p class="muted">עוד אין מתכונים. מתכון הוא התבנית: כמה, קמחים, הידרציה ותוספות. כל אפייה חדשה יוצאת ממנו.</p>}
      {sorted.map((r) => (
        <section class="card" data-testid="recipe">
          <div class="row">
            <strong>{r.name}</strong>
            <button class="btn small" aria-label={r.fav ? `הסר ${r.name} ממועדפים` : `הוסף ${r.name} למועדפים`} onClick={() => patch(r.id, { fav: !r.fav })}>{r.fav ? '★' : '☆'}</button>
          </div>
          <span class="muted">
            {[r.loaves > 0 && `${r.loaves} לחמים`, r.rolls > 0 && `${r.rolls} לחמניות`, ...r.inclusions].filter(Boolean).join(' · ')}
          </span>
          <div class="grid2">
            <a class="btn primary" href={`#/new/${r.id}`} style="display:flex;justify-content:center;text-decoration:none">אפייה חדשה</a>
            <a class="btn" href={`#/recipe/${r.id}`} style="display:flex;justify-content:center;text-decoration:none;color:inherit">עריכה</a>
          </div>
          <button class="btn small" onClick={() => download(`${r.name}.html`, recipeHtml(r, pct), 'text/html;charset=utf-8')}>דף HTML לשיתוף</button>
          <button class="btn small" aria-label={`מחק את ${r.name}`} onClick={() => setState({ recipes: recipes.filter((x) => x.id !== r.id) })}>מחק מתכון</button>
        </section>
      ))}
    </main>
  );
}
