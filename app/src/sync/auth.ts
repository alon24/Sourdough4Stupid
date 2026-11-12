/**
 * Google sign-in. Web: Google Identity Services token client (needs the OAuth client id).
 * Android wrapper: window.SourdoughAuth.getToken() when the native side provides it
 * (Google blocks OAuth inside a plain WebView, so the web flow is not used there).
 */
declare global {
  interface Window {
    SourdoughAuth?: { getToken(): Promise<string> };
    google?: { accounts: { oauth2: { initTokenClient(c: unknown): { requestAccessToken(o?: { prompt?: string }): void }; revoke(t: string, cb: () => void): void } } };
  }
}

export const CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const K = 'machmetzet.sync.auth';

interface Saved {
  connected: boolean;
  token?: string;
  exp?: number;
}
const read = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(K) ?? '') as Saved;
  } catch {
    return { connected: false };
  }
};
const write = (s: Saved) => {
  try {
    localStorage.setItem(K, JSON.stringify(s));
  } catch {
    /* in memory only */
  }
};

export const isConnected = (): boolean => read().connected;
export const canSignIn = (): boolean => !!window.SourdoughAuth || !!CLIENT_ID;

let gsi: Promise<void> | undefined;
const loadGsi = () =>
  (gsi ??= new Promise<void>((ok, fail) => {
    if (window.google) return ok();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => ok();
    s.onerror = () => {
      gsi = undefined;
      fail(new Error('no network for Google sign-in'));
    };
    document.head.appendChild(s);
  }));

function request(prompt: string): Promise<string> {
  return new Promise((ok, fail) => {
    const c = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r: { access_token?: string; expires_in?: number; error?: string }) => {
        if (!r.access_token) return fail(new Error(r.error ?? 'sign-in failed'));
        write({ connected: true, token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 });
        ok(r.access_token);
      },
      error_callback: (e: { type?: string }) => fail(new Error(e.type ?? 'sign-in failed')),
    });
    c.requestAccessToken({ prompt });
  });
}

/** user tapped "sign in" (must come from a click: it opens a popup) */
export async function signIn(): Promise<void> {
  if (window.SourdoughAuth) {
    write({ connected: true });
    await window.SourdoughAuth.getToken();
    return;
  }
  await loadGsi();
  await request('consent');
}

/** a valid token, refreshed silently when it expired */
export async function getToken(): Promise<string> {
  if (window.SourdoughAuth) return window.SourdoughAuth.getToken();
  const s = read();
  if (!s.connected) throw new Error('not signed in');
  if (s.token && (s.exp ?? 0) > Date.now()) return s.token;
  await loadGsi();
  return request('');
}

export function signOut(): void {
  const t = read().token;
  if (t) try { window.google?.accounts.oauth2.revoke(t, () => undefined); } catch { /* ignore */ }
  write({ connected: false });
}
