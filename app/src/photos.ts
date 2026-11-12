import { useEffect, useState } from 'preact/hooks';

/** Photos live in IndexedDB (localStorage is too small); the plan and the journal only keep ids. */
const DB = 'machmetzet-photos';
const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const t = db.transaction('p', 'readwrite');
    t.objectStore('p').put(blob, id);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

export async function loadPhoto(id: string): Promise<Blob | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction('p').objectStore('p').get(id);
    r.onsuccess = () => res(r.result as Blob | undefined);
    r.onerror = () => rej(r.error);
  });
}

/** Shrink a camera photo to at most 1024px JPEG so a bake's photos stay small. */
export async function shrink(file: File, max = 1024): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.75));
  } catch {
    return file;
  }
}

export function usePhotoUrl(id: string): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '';
    loadPhoto(id).then((b) => { if (b) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {});
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return url;
}
