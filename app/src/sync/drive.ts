import type { Remote, SyncDoc } from '../../../core/src/index';

const FILE = 'machmetzet-sync.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class AuthError extends Error {}

/** One JSON file in the hidden per-app Drive folder (scope drive.appdata): the app cannot see the user's other files. */
export function driveRemote(getToken: () => Promise<string>, f: typeof fetch = (...a) => fetch(...a)): Remote {
  let fileId: string | undefined;
  const call = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const res = await f(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await getToken()}` } });
    if (res.status === 401 || res.status === 403) throw new AuthError(`Drive ${res.status}`);
    if (!res.ok) throw new Error(`Drive ${res.status}`);
    return res;
  };
  const find = async (): Promise<string | undefined> => {
    if (fileId) return fileId;
    const q = encodeURIComponent(`name='${FILE}'`);
    const r = await call(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
    fileId = ((await r.json()) as { files: { id: string }[] }).files[0]?.id;
    return fileId;
  };
  return {
    async pull() {
      const id = await find();
      if (!id) return null;
      const r = await call(`${API}/files/${id}?alt=media`);
      return (await r.json()) as SyncDoc;
    },
    async push(doc) {
      const id = await find();
      const body = JSON.stringify(doc);
      if (id) {
        await call(`${UPLOAD}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
        return;
      }
      const boundary = 'sd' + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'], mimeType: 'application/json' });
      const r = await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`,
      });
      fileId = ((await r.json()) as { id: string }).id;
    },
  };
}
