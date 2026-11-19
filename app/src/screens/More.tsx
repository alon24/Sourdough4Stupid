import { AlarmCheck } from './Alarms';
import { useState } from 'preact/hooks';
import { isNative } from '../native';
import { StarterCard } from './StarterCard';

const WEB = 'https://alon24.github.io/Sourdough4Stupid/';

/** Manual "is there a new version?": compares with the version published on the web. */
function VersionCheck() {
  const native = isNative();
  const [state, setState] = useState<'idle' | 'busy' | 'same' | 'newer' | 'fail'>('idle');
  const check = async () => {
    setState('busy');
    try {
      const j = await (await fetch(`${WEB}version.json?t=${Date.now()}`, { cache: 'no-store' })).json();
      if (!native) await (await navigator.serviceWorker?.getRegistration())?.update().catch(() => undefined);
      setState(j.version === __APP_VERSION__ ? 'same' : 'newer');
    } catch { setState('fail'); }
  };
  const reload = () => (window.__updateSW ? void window.__updateSW(true) : location.reload());
  return (
    <div class="card" data-testid="version-check">
      <button class="btn" disabled={state === 'busy'} onClick={() => void check()}>🔄 בדוק אם יש גרסה חדשה</button>
      {state === 'same' && <span class="muted">יש לך את הגרסה העדכנית ✓</span>}
      {state === 'fail' && <span class="muted">לא הצלחתי לבדוק. יש חיבור לאינטרנט?</span>}
      {state === 'newer' && (native
        ? <><span class="muted">בווב יש גרסה חדשה יותר.</span><a class="btn primary" href={WEB} target="_blank" rel="noopener">עבור לווב</a></>
        : <><span class="muted">יש גרסה חדשה.</span><button class="btn primary" onClick={reload}>לרענן ולעדכן</button></>)}
    </div>
  );
}

/** Everything that is not a daily screen: calculator, help, sync, the Android app and the alarm check. */
export function More() {
  return (
    <main>
      <div>
        <span class="sub">עוד</span>
        <h1>עוד</h1>
      </div>
      <StarterCard />
      <AlarmCheck />
      <VersionCheck />
      <a class="btn" href="#/care">טיפול בסטארטר</a>
      <a class="btn" href="#/calc">מחשבון סטארטר</a>
      <a class="btn" href="#/help">עזרה ומדריך</a>
      {!isNative() && <a class="btn" href="#/app">הורדת אפליקציית אנדרואיד</a>}
      <a class="btn" href="#/sync">סנכרון עם Google Drive</a>
    </main>
  );
}
