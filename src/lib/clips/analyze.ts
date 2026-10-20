/** Finds strong moments from the audio alone: loudness, energy and how much it varies (laughs, raised
 *  voices, punchlines). The fallback when there's no speech to transcribe; moments.ts does the real work. */

export type Moment = { id: string; start: number; end: number; score: number; reasons: string[] };

export const HOP = 0.25; // seconds per envelope frame

/** Loudness per 0.25 s frame of mono audio. */
export function envelopeOf(audio: Float32Array, sampleRate: number): Float32Array {
  const H = Math.max(1, Math.floor(sampleRate * HOP));
  const frames = Math.floor(audio.length / H);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let k = f * H; k < (f + 1) * H; k++) s += audio[k] * audio[k];
    env[f] = Math.sqrt(s / H);
  }
  return env;
}

/** Slide a window over the z-scored loudness; score = mean + 0.6·spread − silence; keep the best non-overlapping ones. */
export function pickMoments(env: Float32Array, duration: number, count: number, length: number): Moment[] {
  const n = env.length;
  if (n < 8) return [];
  let mean = 0;
  for (const v of env) mean += v;
  mean /= n;
  let sd = 0;
  for (const v of env) sd += (v - mean) ** 2;
  sd = Math.sqrt(sd / n) || 1;
  const z = Float32Array.from(env, (v) => (v - mean) / sd);
  const quiet = mean * 0.25;

  const win = Math.min(n, Math.round(length / HOP));
  const step = Math.max(1, Math.round(1 / HOP));
  const cands: { i: number; score: number; mean: number; spread: number; silent: number }[] = [];
  for (let i = 0; i + win <= n; i += step) {
    let m = 0, m2 = 0, silent = 0;
    for (let k = i; k < i + win; k++) {
      m += z[k];
      m2 += z[k] * z[k];
      if (env[k] < quiet) silent++;
    }
    m /= win;
    const spread = Math.sqrt(Math.max(0, m2 / win - m * m));
    cands.push({ i, score: m + 0.6 * spread - 2 * (silent / win), mean: m, spread, silent: silent / win });
  }
  cands.sort((a, b) => b.score - a.score);

  const chosen: typeof cands = [];
  for (const c of cands) {
    if (chosen.length >= count) break;
    if (chosen.every((o) => Math.abs(o.i - c.i) >= win)) chosen.push(c);
  }
  const top = chosen[0]?.score ?? 1;
  const low = chosen[chosen.length - 1]?.score ?? 0;
  return chosen
    .map((c, idx) => {
      // snap the cut points to the quietest frame nearby so a clip doesn't start mid-word
      const s = snapQuiet(env, c.i, -Math.round(3 / HOP), Math.round(1 / HOP));
      const e = snapQuiet(env, c.i + win, -Math.round(1 / HOP), Math.round(3 / HOP));
      return {
        id: `m${idx}`,
        start: Math.max(0, s * HOP),
        end: Math.min(duration, e * HOP),
        score: top === low ? 1 : (c.score - low) / (top - low),
        reasons: reasonsFor(c),
      };
    })
    .sort((a, b) => a.start - b.start);
}

/** Plain-French reasons, from what the audio actually shows. */
function reasonsFor(c: { mean: number; spread: number; silent: number }): string[] {
  const r: string[] = [];
  if (c.mean > 0.5) r.push("Énergie haute");
  if (c.spread > 1.1) r.push("Réactions");
  if (c.silent < 0.05) r.push("Aucun blanc");
  if (!r.length) r.push("Moment le plus vivant du passage");
  return r;
}

/** Move a clip earlier (-1) or later (+1) by about a third of its length, cut at the nearest pauses. */
export function shiftMoment(env: Float32Array, m: Moment, dir: -1 | 1, duration: number): Moment {
  const len = m.end - m.start;
  const off = dir * Math.max(4, len / 3);
  const near = Math.round(1.5 / HOP);
  let s = snapQuiet(env, Math.round((m.start + off) / HOP), -near, near) * HOP;
  let e = snapQuiet(env, Math.round((m.end + off) / HOP), -near, near) * HOP;
  if (s < 0) { e -= s; s = 0; }
  if (e > duration) { s -= e - duration; e = duration; }
  return { ...m, start: Math.max(0, s), end: Math.min(duration, Math.max(s + 5, e)) };
}

function snapQuiet(env: Float32Array, at: number, back: number, fwd: number): number {
  let best = Math.min(env.length - 1, Math.max(0, at));
  for (let k = Math.max(0, at + back); k <= Math.min(env.length - 1, at + fwd); k++) {
    if (env[k] < env[best]) best = k;
  }
  return best;
}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
