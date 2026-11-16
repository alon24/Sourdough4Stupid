import { useEffect, useRef, useState } from 'preact/hooks';
import { setReturnTo } from './nav';
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
  /** the new-bake wizard stays mounted (hidden) while the starter screen is open from it, so back returns to the same step with everything kept */
  const [keep, setKeep] = useState<string | null>(null);
  const prev = useRef(hash);
  useEffect(() => {
    const was = prev.current;
    prev.current = hash;
    if (hash.startsWith('#/new')) { setKeep(hash); setReturnTo(null); }
    else if (hash === '#/starter' && was.startsWith('#/new')) { setReturnTo(was); }
    else if (hash !== '#/starter') { setKeep(null); setReturnTo(null); }
  }, [hash]);
  useEffect(() => {
    const on = () => { moves++; setHash(location.hash || '#/'); };
    addEventListener('hashchange', on);
    setHash(location.hash || '#/'); // catch a change that happened before the listener was attached
    return () => removeEventListener('hashchange', on);
  }, []);

  const kept = hash.startsWith('#/new') ? hash : keep;
  const screen =
    hash.startsWith('#/log') ? <Log key={hash} /> : hash === '#/more' ? <More /> : hash === '#/plan' ? <PlanScreen /> : hash === '#/recipes' ? <Recipes /> : hash === '#/recipe' ? <Wizard key="r" kind="recipe" /> : hash.startsWith('#/recipe/') ? <Wizard key={hash} kind="recipe" recipeId={hash.slice(9)} /> : hash.startsWith('#/new') ? null : hash === '#/start' ? <Start /> : hash === '#/starter' ? <StarterStatus /> : hash === '#/calc' ? <Calc /> : hash === '#/help' ? <Help /> : hash === '#/sync' ? <Sync /> : hash === '#/app' ? <Download /> : <Home />;

  return (
    <>
      <Boundary resetKey={hash} quiet><Reminder /></Boundary>
      <UpdateBanner />
      {!TAB_HASHES.has(hash.split('?')[0]!) && !hash.startsWith('#/log') && (
        <button class="back" aria-label="אחורה" onClick={() => back(hash.startsWith('#/recipe') ? '#/recipes' : hash === '#/starter' ? '#/' : hash.startsWith('#/new') ? '#/' : '#/more')}>→ חזרה</button>
      )}
      {kept && (
        <div hidden={hash !== kept} data-testid="wizard-keep">
          <Boundary resetKey={kept}>{kept.startsWith('#/new/') ? <Wizard key={kept} recipeId={kept.slice(6)} /> : <Wizard key="n" />}</Boundary>
        </div>
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
