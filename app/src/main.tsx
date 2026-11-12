import { render } from 'preact';
import { App } from './app';
import './ui.css';
import { startNative } from './native';
import { startSync } from './sync/index';

startNative();
startSync();

// service worker: tell the user when a new version is waiting, and look for one on every start and every return to the app
if ('serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    window.__updateSW = registerSW({
      onNeedRefresh: () => dispatchEvent(new Event('machmetzet-update')),
      onRegisteredSW: (_url, reg) => {
        const check = () => void reg?.update().catch(() => undefined);
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
        check();
      },
    });
  });
}

render(<App />, document.getElementById('app')!);
