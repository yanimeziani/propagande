/** Renders one moment as a vertical 9:16 clip in the browser: a hidden video plays the range,
 *  each frame is drawn reframed onto a canvas, and MediaRecorder captures canvas + audio.
 *  Real time (a 30 s clip takes about 30 s). Nothing leaves the device. */

export type ExportResult = { blob: Blob; ext: "mp4" | "webm" };

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

export async function exportClip(
  src: string,
  range: { start: number; end: number },
  focusX: number, // 0 = left edge of the frame, 1 = right edge
  onProgress?: (p: number) => void,
  size = { w: 720, h: 1280 }
): Promise<ExportResult> {
  const { mime, ext } = pickMime();
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

  video.currentTime = range.start;
  await new Promise<void>((res) => (video.onseeked = () => res()));

  const draw = () => {
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
  };

  rec.start(250);
  await video.play();
  await new Promise<void>((res) => {
    const tick = () => {
      draw();
      const p = (video.currentTime - range.start) / (range.end - range.start);
      onProgress?.(Math.min(1, Math.max(0, p)));
      if (video.currentTime >= range.end || video.ended) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  video.pause();
  rec.stop();
  await done;
  await ac.close();
  video.removeAttribute("src");
  video.load();
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext };
}
