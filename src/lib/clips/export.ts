/** Renders a clip as vertical 9:16 in the browser: a hidden video plays each segment in order, each frame
 *  is drawn reframed onto a canvas with the captions, and MediaRecorder captures canvas + audio. The
 *  recorder pauses during seeks, so a cold open (punch, then the moment) comes out as one clean file.
 *  Real time: a 30 s clip takes about 30 s. Nothing leaves the device. */
import { capText, captionAt, segsLength, type Chunk, type Seg } from "./moments";

export type ExportResult = { blob: Blob; ext: "mp4" | "webm" };
export type ExportOpts = { captions?: Chunk[] | null; endCard?: boolean; onProgress?: (p: number) => void; size?: { w: number; h: number } };

const END_CARD_S = 1.4;

/** The last 1.4 s of an export: « Fait avec PROPAGANDE · madelucid.com/clip » (the /clip path counts end-card visits). On by default, one tap to remove. */
function drawEndCard(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, sans: string, stencil: string) {
  const a = Math.min(1, t / 0.25);
  ctx.fillStyle = "#0f0f0f";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,247,239,0.75)";
  ctx.font = `600 ${Math.round(W * 0.05)}px ${sans}`;
  ctx.fillText("Fait avec", W / 2, H * 0.43);
  ctx.fillStyle = AMBER;
  ctx.font = `900 ${Math.round(W * 0.17)}px ${stencil}`;
  ctx.fillText("PROPAGANDE", W / 2, H * 0.5, W * 0.9);
  ctx.fillStyle = "rgba(255,247,239,0.75)";
  ctx.font = `600 ${Math.round(W * 0.042)}px ${sans}`;
  ctx.fillText("madelucid.com/clip", W / 2, H * 0.58);
  ctx.restore();
}

const AMBER = "#fe8b02";

function pickMime(): { mime: string; ext: "mp4" | "webm" } {
  const opts: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [m, e] of opts) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: e };
  throw new Error("Ce navigateur ne peut pas enregistrer de vidéo. Essaie Chrome ou Safari récent.");
}

/** A 30 Hz clock from a worker. Unlike requestAnimationFrame it keeps running when the tab is in the
 *  background, so a long « Tout télécharger » survives the clipper switching tabs. */
function ticker(): { next: () => Promise<void>; stop: () => void } {
  const code = "setInterval(() => postMessage(0), 33);";
  const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const w = new Worker(blobUrl);
  let wake: (() => void) | null = null;
  w.onmessage = () => { const f = wake; wake = null; f?.(); };
  return {
    next: () => new Promise<void>((res) => { wake = res; }),
    stop: () => { w.terminate(); URL.revokeObjectURL(blobUrl); },
  };
}

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((res) => {
    v.onseeked = () => res();
    v.currentTime = t;
  });

/** Big bold words, white with a dark outline, the word being said in amber. Pops in for 120 ms. */
export function drawCaption(ctx: CanvasRenderingContext2D, chunks: Chunk[], t: number, W: number, H: number, family: string) {
  const at = captionAt(chunks, t);
  if (!at) return;
  const size = Math.round(W * 0.085);
  const pop = Math.min(1, at.age / 0.12);
  const scale = 0.86 + 0.14 * (1 - (1 - pop) ** 3);
  ctx.save();
  ctx.translate(W / 2, H * 0.7);
  ctx.scale(scale, scale);
  ctx.font = `800 ${size}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = "rgba(15,15,15,0.92)";
  const words = at.chunk.words.map((w) => capText(w.w));
  const space = ctx.measureText(" ").width;
  // wrap into lines that fit 86 % of the width
  const lines: { w: string; k: number }[][] = [[]];
  let lineW = 0;
  words.forEach((w, k) => {
    const ww = ctx.measureText(w).width;
    if (lines[lines.length - 1].length && lineW + space + ww > W * 0.86) { lines.push([]); lineW = 0; }
    lines[lines.length - 1].push({ w, k });
    lineW += (lineW ? space : 0) + ww;
  });
  const lh = size * 1.12;
  lines.forEach((line, li) => {
    const total = line.reduce((s, x, n) => s + ctx.measureText(x.w).width + (n ? space : 0), 0);
    let x = -total / 2;
    const y = (li - (lines.length - 1) / 2) * lh;
    for (const { w, k } of line) {
      ctx.strokeText(w, x, y);
      ctx.fillStyle = k === at.active ? AMBER : "#ffffff";
      ctx.fillText(w, x, y);
      x += ctx.measureText(w).width + space;
    }
  });
  ctx.restore();
}

export function captionFamily(): string {
  return typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif";
}

export async function exportClip(src: string, segs: Seg[], focusX: number, opts: ExportOpts = {}): Promise<ExportResult> {
  const { mime, ext } = pickMime();
  const size = opts.size ?? { w: 720, h: 1280 };
  const family = captionFamily();
  const stencil = getComputedStyle(document.body).getPropertyValue("--font-stencil-src").trim() || "Impact, sans-serif";
  if (opts.captions || opts.endCard) await document.fonts?.load(`800 60px ${family}`).catch(() => {});
  if (opts.endCard) await document.fonts?.load(`900 100px ${stencil}`).catch(() => {});

  const video = document.createElement("video");
  video.src = src;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Impossible de lire la vidéo."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);

  const ac = new AudioContext();
  const node = ac.createMediaElementSource(video);
  const dest = ac.createMediaStreamDestination();
  node.connect(dest); // recorded, not played through the speakers
  for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));

  const draw = (segStart: number, k: number) => {
    const vw = video.videoWidth, vh = video.videoHeight;
    const target = size.w / size.h;
    let sw = vw, sh = vh, sx = 0, sy = 0;
    if (vw / vh > target) {
      sw = vh * target;
      sx = (vw - sw) * Math.min(1, Math.max(0, focusX));
    } else {
      sh = vw / target;
      sy = (vh - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size.w, size.h);
    if (opts.captions) drawCaption(ctx, opts.captions, video.currentTime, size.w, size.h, family);
    // the cut back after a cold open: a short white flash, so the jump reads as intended
    const since = video.currentTime - segStart;
    if (k > 0 && since < 0.18) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - since / 0.18)})`;
      ctx.fillRect(0, 0, size.w, size.h);
    }
  };

  const total = segsLength(segs) + (opts.endCard ? END_CARD_S : 0);
  const clock = ticker();
  let before = 0;
  try {
    for (let k = 0; k < segs.length; k++) {
      const seg = segs[k];
      await seek(video, seg.start);
      draw(seg.start, k);
      if (k === 0) rec.start(250);
      else rec.resume();
      await video.play();
      while (video.currentTime < seg.end && !video.ended) {
        await clock.next();
        draw(seg.start, k);
        opts.onProgress?.(Math.min(1, (before + Math.max(0, video.currentTime - seg.start)) / total));
      }
      video.pause();
      before += seg.end - seg.start;
      if (k < segs.length - 1) rec.pause();
    }
    if (opts.endCard) {
      const t0 = performance.now();
      for (let t = 0; t < END_CARD_S; t = (performance.now() - t0) / 1000) {
        drawEndCard(ctx, t, size.w, size.h, family, stencil);
        opts.onProgress?.(Math.min(1, (before + t) / total));
        await clock.next();
      }
    }
  } finally {
    clock.stop();
    if (rec.state !== "inactive") rec.stop();
    await done;
    await ac.close();
    video.removeAttribute("src");
    video.load();
  }
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext };
}
