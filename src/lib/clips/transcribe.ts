/** Speech to words, on the device. Picks the runtime (WebGPU + large-v3-turbo, or WASM + small),
 *  cuts the audio into windows at pauses, runs the worker and caches the result per file. */
import type { Runtime, WorkerIn, WorkerOut } from "./transcribe.worker";
import type { Word } from "./moments";
import { hasModelFile } from "./model-store";

export const SR = 16000;
const TURBO = "onnx-community/whisper-large-v3-turbo_timestamped";
const SMALL = "onnx-community/whisper-small_timestamped";

export type Progress =
  | { stage: "model"; loaded: number; total: number }
  | { stage: "speech"; done: number; total: number }
  | { stage: "lang"; code: string };

export async function pickRuntime(): Promise<Runtime & { label: string }> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
  if (adapter) {
    const f16 = adapter.features.has("shader-f16");
    const q = f16 ? "q4f16" : "q4";
    return { model: TURBO, device: "webgpu", dtype: { encoder_model: q, decoder_model_merged: q }, label: "large-v3-turbo · GPU" };
  }
  return { model: SMALL, device: "wasm", dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, label: "small · CPU" };
}

const SUFFIX: Record<string, string> = { q4f16: "q4f16", q4: "q4", q8: "quantized", fp16: "fp16" };
const SIZE_MB: Record<string, number> = { [`${TURBO}|q4f16`]: 566, [`${TURBO}|q4`]: 760, [`${SMALL}|q8`]: 250 };

/** What the first run will cost the visitor, so we can ask before downloading anything. */
export async function modelStatus(rt: Runtime): Promise<{ cached: boolean; sizeMb: number; cellular: boolean }> {
  const q = rt.dtype.encoder_model;
  const sizeMb = SIZE_MB[`${rt.model}|${q}`] ?? 600;
  const conn = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection;
  const cellular = conn?.type === "cellular" || !!conn?.saveData;
  const cached = await hasModelFile(`https://huggingface.co/${rt.model}/resolve/main/onnx/encoder_model_${SUFFIX[q] ?? q}.onnx`);
  return { cached, sizeMb, cellular };
}

/** Decode once at 16 kHz mono: Whisper's rate, and enough for the loudness envelope. */
export async function decodeMono(file: File): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, SR);
  const buf = await ctx.decodeAudioData(await file.arrayBuffer());
  if (buf.numberOfChannels === 1) return new Float32Array(buf.getChannelData(0));
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

/** Windows of at most 28 s, each cut at the quietest moment between 18 and 28 s, so words aren't split.
 *  Near-silent windows are skipped (Whisper invents text on silence). */
export function speechWindows(env: Float32Array, hop: number, duration: number): [number, number][] {
  let mean = 0;
  for (const v of env) mean += v;
  mean /= env.length || 1;
  const out: [number, number][] = [];
  let a = 0;
  while (a < duration - 0.5) {
    let b = Math.min(duration, a + 28);
    if (b < duration) {
      let best = Math.floor((a + 18) / hop);
      for (let k = best; k <= Math.floor(b / hop) && k < env.length; k++) if (env[k] < env[best]) best = k;
      b = best * hop;
    }
    let loud = 0, n = 0;
    for (let k = Math.floor(a / hop); k < Math.min(env.length, Math.floor(b / hop)); k++, n++) loud += env[k];
    if (n && loud / n > mean * 0.15) out.push([a, b]);
    a = b;
  }
  return out;
}

export function transcribe(
  audio: Float32Array,
  windows: [number, number][],
  runtime: Runtime,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal
): Promise<Word[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
    const files = new Map<string, { loaded: number; total: number }>();
    const parts: Word[][] = [];
    let done = 0;
    // Watchdog: if the worker goes quiet for 90 s (a stuck GPU, a lost device), give up so the
    // caller can fall back to audio-only moments instead of waiting forever
    let watchdog = 0;
    const stop = () => { clearTimeout(watchdog); worker.terminate(); };
    const alive = () => {
      clearTimeout(watchdog);
      watchdog = window.setTimeout(() => { stop(); reject(new Error("timeout")); }, 90_000);
    };
    alive();
    signal?.addEventListener("abort", () => { stop(); reject(new DOMException("aborted", "AbortError")); });
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      alive();
      if (m.type === "load") {
        files.set(m.file, { loaded: m.loaded, total: m.total });
        let loaded = 0, total = 0;
        for (const f of files.values()) { loaded += f.loaded; total += f.total; }
        onProgress({ stage: "model", loaded, total });
      } else if (m.type === "lang") {
        onProgress({ stage: "lang", code: m.code });
      } else if (m.type === "ready") {
        onProgress({ stage: "speech", done: 0, total: windows.length });
      } else if (m.type === "words") {
        parts[m.index] = m.words;
        onProgress({ stage: "speech", done: ++done, total: windows.length });
      } else if (m.type === "done") {
        stop();
        resolve(parts.flat().sort((x, y) => x.t0 - y.t0));
      } else if (m.type === "error") {
        stop();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => { stop(); reject(new Error(e.message || "worker")); };
    const copy = new Float32Array(audio); // the worker takes ownership of this copy
    const msg: WorkerIn = { type: "run", audio: copy, windows, runtime, language: "auto" };
    worker.postMessage(msg, [copy.buffer]);
  });
}

/* ---- cache: a transcript per file and model, so a rerun with new settings is instant ---- */
const DB = "madelucid-transcripts";
const STORE = "words";

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// bump the version when word merging changes, so old transcripts are redone
export const cacheKey = (f: File, model: string) => `v2|${f.name}|${f.size}|${f.lastModified}|${model}`;

export async function cachedWords(key: string): Promise<Word[] | null> {
  try {
    const d = await db();
    return await new Promise((res) => {
      const r = d.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => { res((r.result as Word[] | undefined) ?? null); d.close(); };
      r.onerror = () => { res(null); d.close(); };
    });
  } catch {
    return null;
  }
}

export async function cacheWords(key: string, words: Word[]): Promise<void> {
  try {
    const d = await db();
    const t = d.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(words, key);
    t.oncomplete = () => d.close();
  } catch {
    /* private mode or blocked storage: the transcript just isn't cached */
  }
}
