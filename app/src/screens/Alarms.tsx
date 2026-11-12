import { useEffect, useState } from 'preact/hooks';
import { Alarms, isNative } from '../native';

/** Check that the phone will really ring: permissions, battery saving, and a test alarm. */
export function AlarmCheck() {
  const [status, setStatus] = useState<{ notifications: boolean; fullScreen: boolean } | null>(null);
  const [sent, setSent] = useState(false);
  const refresh = () => void Alarms.status().then(setStatus).catch(() => undefined);
  useEffect(() => {
    if (isNative()) refresh();
  }, []);

  if (!isNative()) {
    return (
      <section class="card">
        <strong>שעונים אמיתיים</strong>
        <span class="muted">בדפדפן יש תזכורות רק כשהאפליקציה פתוחה. כדי לקבל שעון מעורר אמיתי במסך הנעול, מתקינים את אפליקציית האנדרואיד.</span>
      </section>
    );
  }
  const ok = status?.notifications && status.fullScreen;
  return (
    <section class="card" aria-label="בדיקת שעונים">
      <div class="row">
        <strong>בדיקת שעונים</strong>
        <span class="tag">{status ? (ok ? 'הכול תקין' : 'חסרה הרשאה') : '...'}</span>
      </div>
      {status && !status.notifications && (
        <button class="btn small" onClick={() => void Alarms.openSettings({ what: 'notifications' })}>לאפשר התראות</button>
      )}
      {status && !status.fullScreen && (
        <button class="btn small" onClick={() => void Alarms.openSettings({ what: 'fullScreen' })}>לאפשר מסך מלא על המסך הנעול</button>
      )}
      <button class="btn small" onClick={() => void Alarms.openSettings({ what: 'battery' })}>לבטל חיסכון בסוללה לאפליקציה</button>
      <button class="btn primary small" onClick={() => void Alarms.test().then(() => setSent(true))}>
        {sent ? 'נשלח, יצלצל בעוד 5 שניות' : 'צלצל לי בעוד 5 שניות'}
      </button>
    </section>
  );
}
