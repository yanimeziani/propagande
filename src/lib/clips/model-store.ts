/** Where the voice model's files live once downloaded: the origin-private file system (OPFS).
 *  The browser's Cache API refuses entries of several hundred MB in some Chromium builds ("Unexpected internal
 *  error"), so the 566 MB weights were silently re-downloaded on every visit. OPFS stores big files reliably.
 *  Used as transformers.js's custom cache in the worker, and read by the page to know if the model is here. */

const DIR = "voice-models";

function nameOf(key: string): string {
  return key.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function dir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create: true });
}

/** A file counts only once its « .ok » marker exists, so a download cut in the middle is never served. */
async function complete(d: FileSystemDirectoryHandle, name: string): Promise<File | null> {
  try {
    await d.getFileHandle(`${name}.ok`);
    const f = await (await d.getFileHandle(name)).getFile();
    return f.size ? f : null;
  } catch {
    return null;
  }
}

export const modelStore = {
  async match(key: string): Promise<Response | undefined> {
    try {
      const f = await complete(await dir(), nameOf(key));
      return f ? new Response(f, { headers: { "content-length": String(f.size) } }) : undefined;
    } catch {
      return undefined;
    }
  },
  async put(key: string, response: Response): Promise<void> {
    const d = await dir();
    const name = nameOf(key);
    const w = await (await d.getFileHandle(name, { create: true })).createWritable();
    await w.write(await response.arrayBuffer());
    await w.close();
    const ok = await (await d.getFileHandle(`${name}.ok`, { create: true })).createWritable();
    await ok.close();
  },
};

export async function hasModelFile(url: string): Promise<boolean> {
  try {
    return !!(await complete(await dir(), nameOf(url)));
  } catch {
    return false;
  }
}

/** Ask the browser not to evict the model when space runs low. Granted silently or not at all. */
export async function keepModel(): Promise<void> {
  try {
    await navigator.storage.persist?.();
  } catch {
    /* not supported */
  }
}
