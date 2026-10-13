import type { CatalogItem } from '../types';

export interface AppConfig {
  retentionHours: number;
  publicBase: string;
  adminEnabled: boolean;
}
export interface SavedPhoto {
  id: string;
  token: string;
  expires: number;
  url: string;
}

const CACHE_KEY = 'catalog-cache-v1';
const FALLBACK: AppConfig = { retentionHours: 24, publicBase: location.origin, adminEnabled: false };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const getConfig = (): Promise<AppConfig> =>
  fetch('/api/config')
    .then((r) => json<AppConfig>(r))
    .catch(() => FALLBACK);

/** Network first, then the cached copy, then the seed file: try-on keeps working offline (FR-18). */
export async function getCatalog(): Promise<CatalogItem[]> {
  const read = async (url: string) => (await json<CatalogItem[]>(await fetch(url, { cache: 'no-cache' }))).filter((i) => i.active);
  try {
    const list = await read('/api/catalog');
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch {
      /* storage full or blocked */
    }
    return list;
  } catch {
    try {
      const c = localStorage.getItem(CACHE_KEY);
      if (c) return JSON.parse(c) as CatalogItem[];
    } catch {
      /* ignore */
    }
    return read('/catalog.json');
  }
}

/** Upload only after the visitor taps Save (FR-14). */
export const uploadPhoto = (blob: Blob): Promise<SavedPhoto> =>
  fetch('/api/photos', { method: 'POST', body: blob, headers: { 'Content-Type': 'image/jpeg' } }).then((r) => json<SavedPhoto>(r));

// admin
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
export const adminList = (t: string) => fetch('/api/catalog?all', { headers: auth(t) }).then((r) => json<CatalogItem[]>(r));
export const adminSave = (t: string, list: CatalogItem[]) =>
  fetch('/api/catalog', { method: 'PUT', headers: { ...auth(t), 'Content-Type': 'application/json' }, body: JSON.stringify(list) }).then(
    (r) => json<{ ok: true }>(r),
  );
export const adminUpload = (t: string, file: File) =>
  fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: auth(t), body: file }).then((r) =>
    json<{ path: string }>(r),
  );
