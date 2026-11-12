import { useEffect, useState } from 'preact/hooks';
import { Calc } from './screens/Calc';
import { Download } from './screens/Download';
import { Help } from './screens/Help';
import { Home } from './screens/Home';
import { PlanScreen } from './screens/Plan';
import { Recipes } from './screens/Recipes';
import { StarterStatus } from './screens/StarterStatus';
import { Start } from './screens/Start';
import { Wizard } from './screens/Wizard';
import { Boundary } from './Boundary';
import { Reminder } from './Reminder';
import { UpdateBanner } from './UpdateBanner';

const TABS = [
  { hash: '#/', label: 'בית' },
  { hash: '#/plan', label: 'תוכנית' },
  { hash: '#/new', label: 'אפייה' },
  { hash: '#/recipes', label: 'מתכונים' },
  { hash: '#/calc', label: 'מחשבון' },
];

export function App() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    addEventListener('hashchange', on);
    on(); // catch a change that happened before the listener was attached
    return () => removeEventListener('hashchange', on);
  }, []);

  const screen =
    hash === '#/plan' ? <PlanScreen /> : hash === '#/recipes' ? <Recipes /> : hash === '#/recipe' ? <Wizard key="r" kind="recipe" /> : hash.startsWith('#/recipe/') ? <Wizard key={hash} kind="recipe" recipeId={hash.slice(9)} /> : hash.startsWith('#/new/') ? <Wizard key={hash} recipeId={hash.slice(6)} /> : hash === '#/new' ? <Wizard key="n" /> : hash === '#/start' ? <Start /> : hash === '#/starter' ? <StarterStatus /> : hash === '#/calc' ? <Calc /> : hash === '#/help' ? <Help /> : hash === '#/app' ? <Download /> : <Home />;

  return (
    <>
      <Boundary resetKey={hash} quiet><Reminder /></Boundary>
      <UpdateBanner />
      <Boundary resetKey={hash}>{screen}</Boundary>
      <nav class="tabs" aria-label="ניווט ראשי">
        {TABS.map((t) => (
          <a href={t.hash} aria-current={hash === t.hash ? 'page' : undefined}>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
