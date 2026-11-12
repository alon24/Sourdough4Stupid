import { useState } from 'preact/hooks';
import { canSignIn, isConnected, signIn, signOut } from '../sync/auth';
import { engine, syncMeta, useSync } from '../sync/index';

const LABEL: Record<string, string> = {
  idle: 'מוכן',
  pending: 'ממתין לסנכרון',
  syncing: 'מסנכרן…',
  synced: 'מסונכרן ✓',
  offline: 'אין רשת. השינויים נשמרים ויסתנכרנו כשהרשת תחזור',
  error: 'הסנכרון נכשל, ננסה שוב אוטומטית',
};

export function Sync() {
  const e = useSync();
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  const on = isConnected();
  const last = e.lastSyncedAt;
  const conflicts = syncMeta().conflicts;

  const connect = async () => {
    setMsg('');
    try {
      await signIn();
      bump((n) => n + 1);
      await engine.run(true);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'ההתחברות נכשלה');
    }
    bump((n) => n + 1);
  };

  return (
    <main>
      <h1>סנכרון עם Google Drive</h1>
      <section class="card">
        <span class="sub">מתכונים, האפייה הפעילה, הסטארטר והיסטוריה נשמרים בתיקייה נסתרת של האפליקציה ב-Drive שלך, כדי שהאתר והאפליקציה יראו אותו דבר. האפליקציה לא רואה אף קובץ אחר שלך.</span>
        {!canSignIn() && <span class="muted">חסר מזהה Google (Client ID). ההגדרה מתוארת ב-docs/SYNC.md.</span>}
        {on ? (
          <>
            <span class="big" role="status">{LABEL[e.status]}</span>
            <span class="muted">{last ? `סונכרן לאחרונה: ${new Date(last).toLocaleString('he-IL')}` : 'עוד לא סונכרן'}</span>
            {e.lastError && <span class="muted" dir="ltr">{e.lastError}</span>}
            <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
              <button class="btn primary small" onClick={() => void engine.run(true)}>סנכרן עכשיו</button>
              <button class="btn small" onClick={() => { signOut(); bump((n) => n + 1); }}>התנתקות</button>
            </div>
          </>
        ) : (
          <button class="btn primary" disabled={!canSignIn()} onClick={() => void connect()}>התחברות עם Google</button>
        )}
        {msg && <span class="muted" dir="ltr">{msg}</span>}
      </section>
      {conflicts.length > 0 && (
        <section class="card">
          <span class="sub">התנגשויות אחרונות (שינוי בשני המכשירים)</span>
          {conflicts.slice(0, 5).map((c) => (
            <span class="muted">
              {new Date(c.at).toLocaleString('he-IL')} · {c.reason === 'edit-vs-delete' ? 'נמחק במקום אחד ונערך באחר: השארנו את הגרסה הערוכה' : c.keptAs ? 'שתי הגרסאות נשמרו: הישנה כ"עותק מסנכרון"' : 'נבחרה הגרסה החדשה יותר'}
            </span>
          ))}
        </section>
      )}
    </main>
  );
}
