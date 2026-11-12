import { useEffect, useState } from 'preact/hooks';
import { Calc } from './screens/Calc';
import { Help } from './screens/Help';
import { Home } from './screens/Home';
import { PlanScreen } from './screens/Plan';
import { Wizard } from './screens/Wizard';
import { Reminder } from './Reminder';

const TABS = [
  { hash: '#/', label: 'בית' },
  { hash: '#/plan', label: 'תוכנית' },
  { hash: '#/new', label: 'אפייה' },
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
    hash === '#/plan' ? <PlanScreen /> : hash === '#/new' ? <Wizard /> : hash === '#/calc' ? <Calc /> : hash === '#/help' ? <Help /> : <Home />;

  return (
    <>
      <Reminder />
      {screen}
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
