import { useEffect, useState } from 'preact/hooks';

declare global {
  interface Window {
    __updateSW?: (reload?: boolean) => Promise<void>;
  }
}

/** "A new version is ready": shown when a new service worker is waiting; one tap reloads onto it. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const on = () => setReady(true);
    addEventListener('machmetzet-update', on);
    return () => removeEventListener('machmetzet-update', on);
  }, []);
  if (!ready) return null;
  return (
    <div class="update" role="status">
      <span>יש גרסה חדשה של האפליקציה</span>
      <button class="btn small" style="background:#FFC93C;border-color:#FFC93C;color:#2B1D3A" onClick={() => void window.__updateSW?.(true)}>
        לרענן
      </button>
    </div>
  );
}
