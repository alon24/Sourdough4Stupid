import { setState, useStore } from '../store';

export function Recipes() {
  const { recipes } = useStore();
  const sorted = [...recipes].sort((a, b) => Number(b.fav) - Number(a.fav));
  const patch = (id: string, p: object) => setState({ recipes: recipes.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  return (
    <main>
      <div>
        <span class="sub">המתכונים שלי</span>
        <h1>מתכונים</h1>
      </div>
      <a class="btn primary" href="#/recipe" style="display:flex;justify-content:center;text-decoration:none">מתכון חדש</a>
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
          <button class="btn small" aria-label={`מחק את ${r.name}`} onClick={() => setState({ recipes: recipes.filter((x) => x.id !== r.id) })}>מחק מתכון</button>
        </section>
      ))}
    </main>
  );
}
