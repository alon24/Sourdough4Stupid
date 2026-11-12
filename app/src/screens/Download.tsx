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

const svg = qrSvg(APP_URL);

export function Download() {
  return (
    <main class="screen">
      <a href="#/" style="font-weight:700;color:inherit;text-decoration:none">‹ חזרה</a>
      <h1>האפליקציה לאנדרואיד</h1>
      <section class="card">
        <span class="muted">עם האפליקציה השעונים המעוררים מצלצלים באמת, גם כשהמסך נעול.</span>
        <a class="btn primary" href={APP_URL} download style="display:flex;justify-content:center;text-decoration:none">הורדת האפליקציה (APK)</a>
        <div data-testid="qr" style="width:220px;max-width:100%;margin:8px auto" dangerouslySetInnerHTML={{ __html: svg }} />
        <span class="muted">סרקו מהטלפון להורדה. אחרי ההורדה צריך לאשר התקנה ממקור לא מוכר.</span>
      </section>
    </main>
  );
}
