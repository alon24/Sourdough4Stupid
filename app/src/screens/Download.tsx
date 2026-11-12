import qrcode from 'qrcode-generator';

// Swap this when there is a store listing.
export const APP_URL = 'https://alon24.github.io/Sourdough4Stupid/machmetzet.apk';

function qrSvg(text: string): string {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  const s = n + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" aria-label="ברקוד להורדת האפליקציה"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#2B1D3A"/></svg>`;
}

const SITE = 'https://alon24.github.io/Sourdough4Stupid/';
/** The QR points at this download page, never at the file: opening the file URL in a tab makes every refresh download it again. */
export function pageUrl(): string {
  const here = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname);
  return `${here ? location.href.split('#')[0] : SITE}#/app`;
}

export function Download() {
  const target = pageUrl();
  return (
    <main class="screen">
      <a href="#/" style="font-weight:700;color:inherit;text-decoration:none">‹ חזרה</a>
      <h1>האפליקציה לאנדרואיד</h1>
      <section class="card">
        <span class="muted">עם האפליקציה השעונים המעוררים מצלצלים באמת, גם כשהמסך נעול.</span>
        <a class="btn primary" href={APP_URL} download="machmetzet.apk" rel="noopener" data-testid="apk-link" style="display:flex;justify-content:center;text-decoration:none">הורדת האפליקציה (APK)</a>
        <div data-testid="qr" data-target={target} style="width:220px;max-width:100%;margin:8px auto" dangerouslySetInnerHTML={{ __html: qrSvg(target) }} />
        <span class="muted">סרקו מהטלפון להורדה.</span>
        <details open>
          <summary>איך מתקינים</summary>
          <ol>
            <li>לוחצים על "הורדת האפליקציה". אם כרום שואל, מאשרים הורדה.</li>
            <li>פותחים את הקובץ מהתראת ההורדה או מתיקיית "הורדות".</li>
            <li>אם מופיעה הודעה שההתקנה חסומה: "הגדרות" ואז מאשרים "התקנה ממקור לא ידוע" לכרום (או לאפליקציית הקבצים), וחוזרים.</li>
            <li>מתקינים, פותחים, ובמסך הראשון מאשרים התראות ושעונים מעוררים.</li>
          </ol>
          <span class="muted">אם לא קורה כלום בלחיצה, העתק את הכתובת ופתח אותה ישירות בכרום: <span class="num" style="direction:ltr;display:inline-block;word-break:break-all">{APP_URL}</span></span>
        </details>
      </section>
    </main>
  );
}
