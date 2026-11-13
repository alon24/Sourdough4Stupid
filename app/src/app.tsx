import { useEffect, useState } from 'preact/hooks';
import { Calc } from './screens/Calc';
import { Download } from './screens/Download';
import { Help } from './screens/Help';
import { Home } from './screens/Home';
import { Log } from './screens/Log';
import { More } from './screens/More';
import { PlanScreen } from './screens/Plan';
import { Recipes } from './screens/Recipes';
import { StarterStatus } from './screens/StarterStatus';
import { Start } from './screens/Start';
import { Sync } from './screens/Sync';
import { Wizard } from './screens/Wizard';
import { Boundary } from './Boundary';
import { Reminder } from './Reminder';
import { UpdateBanner } from './UpdateBanner';

const TABS = [
  { hash: '#/', label: 'בית' },
  { hash: '#/plan', label: 'אפיות' },
  { hash: '#/recipes', label: 'מתכונים' },
  { hash: '#/log', label: 'יומן' },
  { hash: '#/more', label: 'עוד' },
];

/** screens that are one of the tabs: they have no back button */
const TAB_HASHES = new Set(['#/', '#/plan', '#/recipes', '#/log', '#/more']);
let moves = 0;

/** back goes where you came from; with no history it goes to the tab the screen belongs to */
function back(fallback: string) {
  if (moves > 0) history.back();
  else location.hash = fallback;
}

export function App() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => { moves++; setHash(location.hash || '#/'); };
    addEventListener('hashchange', on);
    setHash(location.hash || '#/'); // catch a change that happened before the listener was attached
    return () => removeEventListener('hashchange', on);
  }, []);

  const screen =
    hash.startsWith('#/log') ? <Log key={hash} /> : hash === '#/more' ? <More /> : hash === '#/plan' ? <PlanScreen /> : hash === '#/recipes' ? <Recipes /> : hash === '#/recipe' ? <Wizard key="r" kind="recipe" /> : hash.startsWith('#/recipe/') ? <Wizard key={hash} kind="recipe" recipeId={hash.slice(9)} /> : hash.startsWith('#/new/') ? <Wizard key={hash} recipeId={hash.slice(6)} /> : hash === '#/new' ? <Wizard key="n" /> : hash === '#/start' ? <Start /> : hash === '#/starter' ? <StarterStatus /> : hash === '#/calc' ? <Calc /> : hash === '#/help' ? <Help /> : hash === '#/sync' ? <Sync /> : hash === '#/app' ? <Download /> : <Home />;

  return (
    <>
      <Boundary resetKey={hash} quiet><Reminder /></Boundary>
      <UpdateBanner />
      {!TAB_HASHES.has(hash.split('?')[0]!) && !hash.startsWith('#/log') && (
        <button class="back" onClick={() => back(hash.startsWith('#/recipe') ? '#/recipes' : hash === '#/starter' ? '#/' : hash.startsWith('#/new') ? '#/' : '#/more')}>→ חזרה</button>
      )}
      <Boundary resetKey={hash}>{screen}</Boundary>
      <nav class="tabs" aria-label="ניווט ראשי">
        {TABS.map((t) => (
          <a href={t.hash} aria-current={hash === t.hash || (t.hash === '#/log' && hash.startsWith('#/log')) ? 'page' : undefined}>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
