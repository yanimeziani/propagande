/** Follows one person through a short clip, on the device: EdgeTAM segments the frame you tapped from your
 *  point, then each next frame (forward and backward in time) is prompted with the previous mask's box, a bit
 *  wider, plus its centre. About 8 frames a second at 512 px wide is plenty to show who will be replaced and
 *  to hand the GPU step a clean selection. */
import type { Candidate, TrackIn, TrackOut } from "./track.worker";

export type TrackFrame = { t: number; mask: Uint8Array | null; box: [number, number, number, number] | null; score: number };
export type Track = { width: number; height: number; fps: number; frames: TrackFrame[] };
export type TrackProgress = { stage: "model"; loaded: number; total: number } | { stage: "frames"; done: number; total: number };

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((res) => {
    v.onseeked = () => res();
    v.currentTime = t;
  });

async function hasGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return !!(gpu && (await gpu.requestAdapter().catch(() => null)));
}

export async function trackPerson(
  src: string,
  tap: { x: number; y: number; t: number },  // x, y in 0..1 of the frame
  onProgress: (p: TrackProgress) => void,
  opts: { fps?: number; width?: number; signal?: AbortSignal } = {},
): Promise<Track> {
  const fps = opts.fps ?? 8;
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((res, rej) => { video.onloadedmetadata = () => res(); video.onerror = () => rej(new Error("Impossible de lire la vidéo.")); });
  const W = Math.min(opts.width ?? 512, video.videoWidth);
  const H = Math.round((W * video.videoHeight) / video.videoWidth);
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const worker = new Worker(new URL("./track.worker.ts", import.meta.url), { type: "module" });
  let nextId = 0;
  const waiting = new Map<number, (m: TrackOut) => void>();
  let ready: () => void, failed: (e: Error) => void;
  const readyP = new Promise<void>((res, rej) => { ready = res; failed = rej; });
  worker.onmessage = (e: MessageEvent<TrackOut>) => {
    const m = e.data;
    if (m.type === "ready") ready();
    else if (m.type === "load") onProgress({ stage: "model", loaded: m.loaded, total: m.total });
    else if (m.type === "error") { failed(new Error(m.message)); waiting.forEach((w) => w(m)); waiting.clear(); }
    else if (m.type === "masks") { waiting.get(m.id)?.(m); waiting.delete(m.id); }
  };
  const stop = () => worker.terminate();
  opts.signal?.addEventListener("abort", stop);
  worker.postMessage({ type: "init", device: (await hasGpu()) ? "webgpu" : "wasm" } satisfies TrackIn);

  try {
    await readyP;
    const times: number[] = [];
    for (let t = 0; t < video.duration - 0.01; t += 1 / fps) times.push(Math.round(t * 1000) / 1000);
    const start = times.reduce((b, t, i) => (Math.abs(t - tap.t) < Math.abs(times[b] - tap.t) ? i : b), 0);
    const frames: TrackFrame[] = times.map((t) => ({ t, mask: null, box: null, score: 0 }));

    const segment = async (i: number, points: [number, number][], box?: [number, number, number, number], labels?: number[]): Promise<Candidate[]> => {
      await seek(video, times[i]);
      ctx.drawImage(video, 0, 0, W, H);
      const rgba = ctx.getImageData(0, 0, W, H).data;
      const id = nextId++;
      const res = await new Promise<TrackOut>((r) => {
        waiting.set(id, r);
        worker.postMessage({ type: "segment", id, width: W, height: H, rgba, points, labels, box } satisfies TrackIn, [rgba.buffer]);
      });
      if (res.type !== "masks") throw new Error(res.type === "error" ? res.message : "suivi interrompu");
      return res.candidates;
    };

    // Background leaks look like this: a wide band glued to the top edge (ceiling, sky, wall). A person almost
    // never fills the top edge of the frame across a third of its width.
    const topRows = Math.max(2, Math.round(H * 0.06));
    const topEdge = (c: Candidate) => {
      let n = 0;
      for (let x = 0; x < W; x++) { for (let y = 0; y < topRows; y++) if (c.mask[y * W + x]) { n++; break; } }
      return n / W;
    };
    const plausible = (c: Candidate) => c.area > W * H * 0.002 && c.area < W * H * 0.6 && topEdge(c) < 0.3;
    const iou = (a: Uint8Array, b: Uint8Array) => {
      let inter = 0, uni = 0;
      for (let k = 0; k < a.length; k++) { const x = a[k], y = b[k]; if (x & y) inter++; if (x | y) uni++; }
      return uni ? inter / uni : 0;
    };
    const widen = (b: [number, number, number, number], extra = 0): [number, number, number, number] => {
      const dx = (b[2] - b[0]) * (0.12 + extra), dy = (b[3] - b[1]) * (0.08 + extra / 2);
      return [Math.max(0, b[0] - dx), Math.max(0, b[1] - dy), Math.min(W - 1, b[2] + dx), Math.min(H - 1, b[3] + dy)];
    };
    // Anchor points on the person: the centre of the outline in each of 4 horizontal bands (head, chest, waist, legs)
    const anchors = (mask: Uint8Array, box: [number, number, number, number]): [number, number][] => {
      const pts: [number, number][] = [];
      const bandH = (box[3] - box[1] + 1) / 4;
      for (let k = 0; k < 4; k++) {
        let sx = 0, sy = 0, n = 0;
        for (let y = Math.floor(box[1] + k * bandH); y < Math.min(H, Math.floor(box[1] + (k + 1) * bandH)); y += 2) {
          for (let x = box[0]; x <= box[2]; x += 2) if (mask[y * W + x]) { sx += x; sy += y; n++; }
        }
        if (n > 8) pts.push([sx / n, sy / n]);
      }
      return pts;
    };

    let done = 0;
    const total = times.length;
    // the tapped frame: the largest candidate the model is still fairly sure of (the whole person, not a part)
    const c0 = (await segment(start, [[tap.x * W, tap.y * H]])).filter(plausible);
    if (!c0.length) throw new Error("Personne trouvée à cet endroit. Touche le corps de la personne, pas l'arrière-plan.");
    const top = Math.max(...c0.map((c) => c.score));
    const first = c0.filter((c) => c.score >= top - 0.15).sort((a, b) => b.area - a.area)[0];
    frames[start] = { t: times[start], mask: first.mask, box: first.box, score: first.score };
    onProgress({ stage: "frames", done: ++done, total });

    // then outward in time: anchors + a slightly wider box from the last good outline, and the candidate that
    // overlaps that outline most wins (continuity beats the model's own confidence)
    const inside = (c: Candidate, b: [number, number, number, number]) => {
      let n = 0;
      for (let y = Math.max(0, Math.floor(b[1])); y <= Math.min(H - 1, b[3]); y++)
        for (let x = Math.max(0, Math.floor(b[0])); x <= Math.min(W - 1, b[2]); x++) if (c.mask[y * W + x]) n++;
      return c.area ? n / c.area : 0;
    };
    for (const dir of [1, -1] as const) {
      let last = first, lost = 0;
      for (let i = start + dir; i >= 0 && i < total; i += dir) {
        if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
        // while the person is lost, look a little wider each frame so we catch up with them
        const zone = widen(last.box!, Math.min(0.5, lost * 0.1));
        let cands = (await segment(i, anchors(last.mask, last.box!), zone)).filter(plausible);
        if (!cands.length) {
          // Every candidate merged the person with the background (often the ceiling): ask again without a box,
          // with points on the torso and a "not this" point just above the head
          const pts = anchors(last.mask, last.box!).slice(1);
          const b = last.box!;
          const above: [number, number] = [(b[0] + b[2]) / 2, Math.max(1, b[1] - (b[3] - b[1]) * 0.08)];
          if (pts.length) cands = (await segment(i, [...pts, above], undefined, [...pts.map(() => 1), 0])).filter(plausible);
        }
        let pick: Candidate | null = null, bestIou = -1;
        for (const c of cands) {
          // growth = leaking into the background: per step, and against the person's size at the tap
          if (c.area > last.area * 1.6 || c.area > first.area * 1.5 || c.area < first.area * 0.4) continue;
          const v = iou(c.mask, last.mask);
          // continuity: overlaps the last outline, or sits almost entirely in the expected zone
          if ((v >= 0.35 || inside(c, zone) >= 0.8) && v > bestIou) { bestIou = v; pick = c; }
        }
        if (pick && pick.box) {
          frames[i] = { t: times[i], mask: pick.mask, box: pick.box, score: pick.score };
          last = pick;
          lost = 0;
        } else {
          lost++;
          frames[i] = { t: times[i], mask: null, box: null, score: pick?.score ?? 0 }; // lost: the last good outline keeps guiding
        }
        onProgress({ stage: "frames", done: ++done, total });
      }
    }
    return { width: W, height: H, fps, frames };
  } finally {
    stop();
    video.removeAttribute("src");
    video.load();
  }
}

/** The frame of the track closest to time t. */
export function frameAt(track: Track, t: number): TrackFrame | null {
  if (!track.frames.length) return null;
  const i = Math.min(track.frames.length - 1, Math.max(0, Math.round(t * track.fps)));
  return track.frames[i];
}

/** Share of frames where the person was found: under ~80 %, the GPU step will need a better tap or a cleaner clip. */
export const coverage = (track: Track) => track.frames.filter((f) => f.mask).length / Math.max(1, track.frames.length);
