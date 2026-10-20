/** The taste layer in the browser, mirrored from engine/taste.py and engine/styles/*.json: caption styles,
 *  a two-camera framing rhythm with punch-ins on key words, and beat detection for a music track.
 *  All times are in source-video seconds, like the caption chunks, so preview and export share one plan. */
import type { Seg, Word } from "./moments";

export type StyleId = "propagande" | "podcast-calme" | "hype";
export type Style = {
  id: StyleId;
  label: string;
  captions: { upper: boolean; maxWords: number; maxChars: number; weight: number; size: number; y: number; fill: string; active: string; stroke: number; box: string | null; pop: number };
  pacing: { shot: number; alt: number; punch: number; minGap: number; keywordGap: number };
  music: { gain: number; fade: number };
};

// Same numbers as engine/styles/*.json (size = font size / frame width, y = caption centre from the top)
export const STYLES: Record<StyleId, Style> = {
  propagande: {
    id: "propagande", label: "Propagande",
    captions: { upper: true, maxWords: 3, maxChars: 18, weight: 800, size: 0.072, y: 0.7, fill: "#ffffff", active: "#fe8b02", stroke: 0.2, box: null, pop: 0.14 },
    pacing: { shot: 2.2, alt: 1.08, punch: 1.18, minGap: 1.0, keywordGap: 3.0 },
    music: { gain: 0.14, fade: 0.4 },
  },
  "podcast-calme": {
    id: "podcast-calme", label: "Podcast calme",
    captions: { upper: false, maxWords: 5, maxChars: 30, weight: 600, size: 0.055, y: 0.76, fill: "#ffffff", active: "#ffdfbe", stroke: 0, box: "rgba(0,0,0,0.7)", pop: 0 },
    pacing: { shot: 4.5, alt: 1.05, punch: 1.1, minGap: 2.0, keywordGap: 6.0 },
    music: { gain: 0.1, fade: 0.8 },
  },
  hype: {
    id: "hype", label: "Hype",
    captions: { upper: true, maxWords: 2, maxChars: 12, weight: 800, size: 0.095, y: 0.62, fill: "#ffffff", active: "#ff3403", stroke: 0.22, box: null, pop: 0.12 },
    pacing: { shot: 1.3, alt: 1.12, punch: 1.28, minGap: 0.7, keywordGap: 2.0 },
    music: { gain: 0.2, fade: 0.25 },
  },
};

const HOOK = new Set(`pourquoi comment personne jamais toujours secret vérité erreur argent piège arrête attention voici voilà
imagine regarde problème gratuit million milliard mille fou folie choc interdit illégal truc seul vrai faux
why how never nobody secret truth mistake money stop look imagine free crazy only real fake`.split(/\s+/));
const NUM = new Set(["million", "milliard", "mille", "cent", "%", "$", "zéro", "zero", "thousand", "hundred", "billion"]);
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

export type Zoom = { t: number; scale: number };

/** Framing for one segment [a, b] (source time): alternate wide and tight about every `shot` seconds in the gaps
 *  between words, punch in on numbers, strong words and loud moments, and snap changes to beats when there are any.
 *  `beats` are in source time for this segment. `punchFirst` starts tight (a cold open is the punch line). */
export function zoomPlan(words: Word[], a: number, b: number, style: Style, z: Float32Array | null, hop: number, beats: number[] = [], punchFirst = false): Zoom[] {
  const { shot, alt, punch, minGap, keywordGap } = style.pacing;
  const ws = words.filter((w) => w.t0 >= a - 0.05 && w.t1 <= b + 0.05);
  const zAt = (t: number) => (z ? z[Math.min(z.length - 1, Math.max(0, Math.floor(t / hop)))] : 0);
  const snap = (t: number) => {
    if (!beats.length) return t;
    const near = beats.reduce((p, x) => (Math.abs(x - t) < Math.abs(p - t) ? x : p), beats[0]);
    return Math.abs(near - t) <= 0.3 ? near : t;
  };
  const score = (w: Word) => {
    const n = norm(w.w);
    let s = 0;
    if (/\d/.test(n) || NUM.has(n)) s += 2;
    if (HOOK.has(n)) s += 1.5;
    if (/[!?]$/.test(w.w)) s += 1;
    return s + Math.max(0, zAt(w.t0) - 0.8);
  };
  const punches: number[] = [];
  for (const w of [...ws].sort((x, y) => score(y) - score(x))) {
    if (score(w) < 1.5) break;
    if (punches.every((q) => Math.abs(w.t0 - q) >= keywordGap)) punches.push(w.t0);
  }
  const events: { t: number; s: number | null }[] = punches.map((t) => ({ t: snap(Math.max(a, t - 0.05)), s: punch }));
  const gaps = ws.slice(0, -1).map((w, k) => (w.t1 + ws[k + 1].t0) / 2);
  let next = a + shot;
  for (const g of gaps) {
    if (g >= next && events.every((e) => Math.abs(g - e.t) >= minGap)) {
      events.push({ t: snap(g), s: null });
      next = g + shot;
    }
  }
  events.sort((x, y) => x.t - y.t);
  let cur = punchFirst ? punch : 1;
  let last = a;
  const plan: Zoom[] = [{ t: a, scale: cur }];
  for (const e of events) {
    if (e.t - last < minGap || e.t >= b - 0.3) continue;
    const s = e.s ?? (cur === 1 ? alt : 1);
    if (s === cur) continue;
    plan.push({ t: e.t, scale: s });
    cur = s;
    last = e.t;
  }
  return plan;
}

/** The scale in effect at source time t for a segment's plan. */
export function scaleAt(plan: Zoom[], t: number): number {
  let s = plan[0]?.scale ?? 1;
  for (const z of plan) {
    if (z.t <= t) s = z.scale;
    else break;
  }
  return s;
}

/** Beats of a music track (seconds) and its tempo: energy onsets every ~23 ms, autocorrelation between 70 and
 *  180 BPM, a parabola through the peak, then a least-squares fit on the real onset peaks. */
export function detectBeats(audio: Float32Array, sampleRate: number): { beats: number[]; bpm: number } {
  const hop = Math.round(sampleRate * 0.023);
  const n = Math.min(audio.length, sampleRate * 240);
  const env: number[] = [];
  for (let i = 0; i + hop < n; i += hop) {
    let s = 0;
    for (let k = i; k < i + hop; k += 2) s += audio[k] * audio[k];
    env.push(Math.log1p((s / (hop / 2)) * 1e6));
  }
  if (env.length < 50) return { beats: [], bpm: 0 };
  let onset = env.map((v, i) => (i ? Math.max(0, v - env[i - 1]) : 0));
  const mean = onset.reduce((x, y) => x + y, 0) / onset.length;
  onset = onset.map((o) => Math.max(0, o - mean));
  const fps = sampleRate / hop;
  const lo = Math.floor((fps * 60) / 180), hi = Math.ceil((fps * 60) / 70);
  const ac = new Map<number, number>();
  for (let L = Math.max(1, lo - 1); L <= hi + 1; L++) {
    let c = 0;
    for (let i = L; i < onset.length; i++) c += onset[i] * onset[i - L];
    ac.set(L, c);
  }
  let L = lo, best = -1;
  for (let k = lo; k <= hi; k++) {
    const bpm = (60 * fps) / k;
    const v = (ac.get(k) ?? 0) * (1 + 0.15 * Math.exp(-(((bpm - 120) / 40) ** 2)));
    if (v > best) { best = v; L = k; }
  }
  const y0 = ac.get(L - 1) ?? 0, y1 = ac.get(L) ?? 0, y2 = ac.get(L + 1) ?? 0;
  const den = y0 - 2 * y1 + y2;
  let lag = L + (den ? (0.5 * (y0 - y2)) / den : 0);
  let phase = 0, top = -1;
  for (let ph = 0; ph <= Math.floor(lag); ph++) {
    let s = 0;
    for (let t = ph; t < onset.length; t += lag) s += onset[Math.floor(t)];
    if (s > top) { top = s; phase = ph; }
  }
  const pts: [number, number][] = [];
  for (let t = phase, k = 0; t < onset.length; t += lag, k++) {
    const w = Math.max(1, Math.floor(lag * 0.15));
    let j = Math.max(0, Math.floor(t) - w);
    for (let i = j; i <= Math.min(onset.length - 1, Math.floor(t) + w); i++) if (onset[i] > onset[j]) j = i;
    if (onset[j] > 0) pts.push([k, j]);
  }
  if (pts.length >= 4) {
    const m = pts.length;
    const sk = pts.reduce((s, p) => s + p[0], 0), sj = pts.reduce((s, p) => s + p[1], 0);
    const skk = pts.reduce((s, p) => s + p[0] * p[0], 0), skj = pts.reduce((s, p) => s + p[0] * p[1], 0);
    const slope = (m * skj - sk * sj) / (m * skk - sk * sk);
    if (Math.abs(slope - lag) < lag * 0.05) { lag = slope; phase = (sj - slope * sk) / m; }
  }
  const beats: number[] = [];
  for (let t = phase; t < onset.length; t += lag) if (t >= 0) beats.push(t / fps);
  return { beats, bpm: Math.round(((60 * fps) / lag) * 10) / 10 };
}

/** Where to start the track so a beat lands exactly `at` seconds into the clip, with music left for `length`. */
export function musicOffset(beats: number[], at: number, length: number): number {
  for (const b of beats) {
    const off = b - at;
    if (off >= 0 && beats[beats.length - 1] - off >= length * 0.9) return off;
  }
  return beats.length ? Math.max(0, beats[0] - at) : 0;
}

/** One framing plan per segment of a clip, with the music's beats mapped into each segment's source time. */
export function planClip(words: Word[], segs: Seg[], style: Style, z: Float32Array | null, hop: number, beats: number[], offset: number): Zoom[][] {
  let before = 0;
  return segs.map((s, k) => {
    const segBeats = beats.map((b) => b - offset - before + s.start).filter((t) => t >= s.start && t <= s.end);
    before += s.end - s.start;
    return zoomPlan(words, s.start, s.end, style, z, hop, segBeats, k === 0 && segs.length > 1);
  });
}
