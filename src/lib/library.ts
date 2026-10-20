/** « Mes créations »: everything exported, kept in this browser (IndexedDB). Nothing is uploaded.
 *  Components subscribe with onLibraryChange() and re-read with listCreations(). */

export type Tool = "propagande" | "agent-double";
export type Creation = {
  id: string;
  tool: Tool;
  createdAt: number;
  title: string; // e.g. « Moment 3 · live.mp4 »
  source: string; // original file name
  start: number;
  end: number;
  ext: string;
  size: number;
  thumb: string; // small JPEG data URL
  score?: number;
};
type Stored = Creation & { blob: Blob };

const DB = "madelucid";
const STORE = "creations";
const EVENT = "ml-library";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("no-idb"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore(STORE, { keyPath: "id" });
      s.createIndex("createdAt", "createdAt");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function addCreation(c: Omit<Creation, "id" | "createdAt" | "size" | "thumb">, blob: Blob): Promise<Creation> {
  const thumb = await makeThumb(blob).catch(() => "");
  const item: Stored = { ...c, id: crypto.randomUUID(), createdAt: Date.now(), size: blob.size, thumb, blob };
  await tx("readwrite", (s) => s.put(item));
  window.dispatchEvent(new Event(EVENT));
  const { blob: _b, ...meta } = item;
  void _b;
  return meta;
}

export async function listCreations(tool?: Tool): Promise<Creation[]> {
  const all = await tx<Stored[]>("readonly", (s) => s.getAll());
  return all
    .filter((c) => !tool || c.tool === tool)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ blob: _b, ...meta }) => { void _b; return meta; });
}

export async function getBlob(id: string): Promise<Blob | null> {
  const item = await tx<Stored | undefined>("readonly", (s) => s.get(id));
  return item?.blob ?? null;
}

export async function deleteCreation(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event(EVENT));
}

export function onLibraryChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export async function storageUsed(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { used: e.usage ?? 0, quota: e.quota ?? 0 };
}

/** A 180×320 JPEG of the frame at 0.5 s. */
function makeThumb(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = 180;
      c.height = 320;
      c.getContext("2d")!.drawImage(v, 0, 0, 180, 320);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.72));
    };
    v.onerror = () => { URL.revokeObjectURL(url); rej(new Error("thumb")); };
  });
}

export function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

export function fmtWhen(t: number): string {
  const d = Date.now() - t;
  if (d < 60_000) return "à l'instant";
  if (d < 3_600_000) return `il y a ${Math.floor(d / 60_000)} min`;
  if (d < 86_400_000) return `il y a ${Math.floor(d / 3_600_000)} h`;
  return new Date(t).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
