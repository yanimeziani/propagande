/** From words to clips: sentences, the best moments (cut on sentence edges), three ways to open each one,
 *  and caption chunks. Port of engine/propagande.py, plus the cold open. Pure functions, no DOM. */

export type Word = { t0: number; t1: number; w: string };
export type Sentence = { t0: number; t1: number; text: string; words: Word[]; closed: boolean };
export type Seg = { start: number; end: number };
export type HookId = "tel" | "punch" | "question";
export type Hook = { id: HookId; label: string; segs: Seg[]; line: string };
export type TMoment = { id: string; i: number; j: number; start: number; end: number; score: number; reasons: string[]; hooks: Hook[] };
export type Chunk = { t0: number; t1: number; words: Word[] };

const HOOK_WORDS = new Set(
  `pourquoi comment personne jamais toujours secret vérité erreur argent piège arrête attention voici
voilà imagine regarde problème gratuit million milliard mille fou folie choc interdit illégal truc
why how never nobody secret truth mistake money stop look imagine free crazy`.split(/\s+/)
);
const YOU = new Set(["tu", "toi", "ton", "ta", "tes", "vous", "votre", "vos", "you", "your"]);
const DANGLING = new Set(["et", "mais", "ou", "donc", "parce", "que", "qui", "de", "du", "des", "le", "la", "les", "un", "une", "à", "en", "pour", "avec", "sur"]);
const PAD_IN = 0.15;
const PAD_OUT = 0.35;

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");
const startsMid = (x: Sentence) => /^\p{Ll}/u.test(x.words[0]?.w ?? "");
const hasNum = (w: string) => /\d/.test(w) || ["million", "milliard", "mille", "%", "$"].includes(w);

export function sentences(words: Word[]): Sentence[] {
  const out: Sentence[] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const nxt = words[i + 1];
    const closed = /[.!?…]$/.test(w.w);
    if (closed || !nxt || nxt.t0 - w.t1 > 0.7) {
      out.push({ t0: cur[0].t0, t1: cur[cur.length - 1].t1, words: cur, text: cur.map((x) => x.w).join(" "), closed });
      cur = [];
    }
  });
  return out;
}

export function zscore(env: Float32Array): Float32Array {
  let m = 0;
  for (const v of env) m += v;
  m /= env.length || 1;
  let sd = 0;
  for (const v of env) sd += (v - m) ** 2;
  sd = Math.sqrt(sd / (env.length || 1)) || 1;
  return Float32Array.from(env, (v) => (v - m) / sd);
}

function energy(z: Float32Array, hop: number, t0: number, t1: number) {
  const a = Math.floor(t0 / hop), b = Math.max(a + 1, Math.floor(t1 / hop));
  let m = 0, m2 = 0, n = 0;
  for (let k = a; k < Math.min(b, z.length); k++, n++) { m += z[k]; m2 += z[k] * z[k]; }
  if (!n) return { mean: 0, spread: 0 };
  m /= n;
  return { mean: m, spread: Math.sqrt(Math.max(0, m2 / n - m * m)) };
}

function scoreWindow(ss: Sentence[], z: Float32Array, hop: number): { s: number; reasons: string[] } {
  const first = ss[0], last = ss[ss.length - 1];
  const fw = first.words.map((w) => norm(w.w));
  const all = ss.flatMap((x) => x.words.map((w) => norm(w.w)));
  const dur = last.t1 - first.t0;
  const reasons: string[] = [];
  let s = 0;
  // a lowercase start means the cut lands mid-sentence (the sentence split came from a pause)
  if (startsMid(first)) s -= 1.5;
  if (first.text.trimEnd().endsWith("?")) { s += 1.2; reasons.push("Question en ouverture"); }
  if (fw.some(hasNum)) { s += 1.0; reasons.push("Chiffre dans la première phrase"); }
  if (fw.some((w) => YOU.has(w))) { s += 0.6; reasons.push("Parle directement à « tu »"); }
  if (fw.some((w) => HOOK_WORDS.has(w))) { s += 0.8; reasons.push("Mot accrocheur au début"); }
  if (fw.length <= 12) { s += 0.5; reasons.push("Première phrase courte"); }
  if (all.filter((w) => /\d/.test(w)).length >= 2) { s += 0.4; reasons.push("Plusieurs chiffres"); }
  const lw = norm(last.words[last.words.length - 1]?.w ?? "");
  if (last.closed && !DANGLING.has(lw)) { s += 0.7; reasons.push("Finit sur une phrase complète"); } else s -= 0.8;
  if (last.text.trimEnd().endsWith("!")) s += 0.3;
  const e = energy(z, hop, first.t0, last.t1);
  s += 0.6 * e.mean + 0.4 * e.spread;
  if (e.mean > 0.5) reasons.push("Énergie haute");
  const rate = all.length / Math.max(1, dur);
  if (rate < 1.6) s -= 0.6;
  else if (rate > 2.4) { s += 0.3; reasons.push("Débit rapide"); }
  return { s, reasons };
}

/** How well a single sentence works as the first second of a clip. */
function punchScore(x: Sentence, z: Float32Array, hop: number): number {
  const ws = x.words.map((w) => norm(w.w));
  const dur = x.t1 - x.t0;
  if (ws.length < 3 || dur < 0.8 || dur > 7) return -Infinity;
  let s = 0;
  if (x.text.trimEnd().endsWith("?")) s += 1;
  if (x.text.trimEnd().endsWith("!")) s += 0.8;
  if (ws.some(hasNum)) s += 1;
  if (ws.some((w) => HOOK_WORDS.has(w))) s += 0.8;
  if (ws.some((w) => YOU.has(w))) s += 0.4;
  if (ws.length <= 10) s += 0.4;
  if (!x.closed) s -= 0.6;
  if (startsMid(x)) s -= 1.2;
  s += 0.8 * energy(z, hop, x.t0, x.t1).mean;
  return s;
}

const segOf = (a: Sentence, b: Sentence, duration: number): Seg => ({ start: Math.max(0, a.t0 - PAD_IN), end: Math.min(duration, b.t1 + PAD_OUT) });
const quote = (t: string) => t.replace(/\s+/g, " ").trim();

/** Three ways to open the same moment. The cold open plays one of the moment's own sentences first,
 *  then the whole moment from the start: nothing is joined into a new claim. */
export function hooksFor(ss: Sentence[], i: number, j: number, z: Float32Array, hop: number, duration: number): Hook[] {
  const body = segOf(ss[i], ss[j], duration);
  const hooks: Hook[] = [{ id: "tel", label: "Tel quel", segs: [body], line: quote(ss[i].text) }];
  let best = -1, bestS = -Infinity;
  for (let k = i + 1; k <= j; k++) {
    const p = punchScore(ss[k], z, hop);
    if (p > bestS) { bestS = p; best = k; }
  }
  if (best > 0 && bestS > 0.5) {
    hooks.push({ id: "punch", label: "Punch d'abord", segs: [{ start: Math.max(0, ss[best].t0 - 0.08), end: ss[best].t1 + 0.2 }, body], line: quote(ss[best].text) });
  }
  if (!ss[i].text.trimEnd().endsWith("?")) {
    for (let k = i + 1; k <= j; k++) {
      if (k !== best && ss[k].text.trimEnd().endsWith("?") && ss[k].t1 - ss[k].t0 <= 7) {
        hooks.push({ id: "question", label: "Question d'abord", segs: [{ start: Math.max(0, ss[k].t0 - 0.08), end: ss[k].t1 + 0.2 }, body], line: quote(ss[k].text) });
        break;
      }
    }
  }
  return hooks;
}

function build(ss: Sentence[], i: number, j: number, z: Float32Array, hop: number, duration: number, id: string, score: number, reasons: string[]): TMoment {
  const body = segOf(ss[i], ss[j], duration);
  return { id, i, j, start: body.start, end: body.end, score, reasons, hooks: hooksFor(ss, i, j, z, hop, duration) };
}

/** Every sentence-bounded window between lo and hi seconds, scored; the best non-overlapping ones win. */
export function pickFromTranscript(ss: Sentence[], z: Float32Array, hop: number, duration: number, count: number, lo: number, hi: number): TMoment[] {
  const cands: { s: number; i: number; j: number; reasons: string[] }[] = [];
  for (let i = 0; i < ss.length; i++) {
    for (let j = i; j < ss.length; j++) {
      const d = ss[j].t1 - ss[i].t0;
      if (d > hi) break;
      if (d >= lo) cands.push({ ...scoreWindow(ss.slice(i, j + 1), z, hop), i, j });
    }
  }
  cands.sort((a, b) => b.s - a.s);
  const chosen: typeof cands = [];
  for (const c of cands) {
    if (chosen.length >= count) break;
    if (chosen.every((o) => c.j < o.i || c.i > o.j)) chosen.push(c);
  }
  const top = chosen[0]?.s ?? 1, low = chosen[chosen.length - 1]?.s ?? 0;
  return chosen
    .sort((a, b) => a.i - b.i)
    .map((c, k) => build(ss, c.i, c.j, z, hop, duration, `t${k}-${c.i}`, top === low ? 1 : (c.s - low) / (top - low), c.reasons.slice(0, 3)));
}

/** Plus tôt / plus tard: slide the moment by one sentence, keeping its length. */
export function shiftBySentence(ss: Sentence[], m: TMoment, dir: -1 | 1, z: Float32Array, hop: number, duration: number): TMoment {
  const i = m.i + dir, j = m.j + dir;
  if (i < 0 || j >= ss.length) return m;
  return build(ss, i, j, z, hop, duration, `t-${i}-${j}`, m.score, scoreWindow(ss.slice(i, j + 1), z, hop).reasons.slice(0, 3));
}

/** Caption chunks of 1–3 words (18 characters at most), timed to the words. Times stay in source time,
 *  so the same chunks work for every hook and every segment order. */
export function captionChunks(words: Word[], maxWords = 3, maxChars = 18): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  words.forEach((w, k) => {
    cur.push(w);
    const nxt = words[k + 1];
    const len = cur.map((x) => x.w).join(" ").length;
    if (cur.length >= maxWords || len >= maxChars || /[.!?…,:;]$/.test(w.w) || !nxt || nxt.t0 - w.t1 > 0.5) {
      const t1 = nxt && nxt.t0 - w.t1 < 0.5 ? nxt.t0 : w.t1 + 0.15;
      out.push({ t0: cur[0].t0, t1: Math.max(cur[0].t0 + 0.1, t1), words: cur });
      cur = [];
    }
  });
  for (let k = 1; k < out.length; k++) out[k].t0 = Math.max(out[k].t0, out[k - 1].t0 + 0.05);
  for (let k = 0; k < out.length - 1; k++) out[k].t1 = Math.min(out[k].t1, out[k + 1].t0);
  return out;
}

/** The chunk on screen at source time t, and which of its words is being said. */
export function captionAt(chunks: Chunk[], t: number): { chunk: Chunk; active: number; age: number } | null {
  let lo = 0, hi = chunks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = chunks[mid];
    if (t < c.t0) hi = mid - 1;
    else if (t >= c.t1) lo = mid + 1;
    else {
      let active = 0;
      c.words.forEach((w, k) => { if (t >= w.t0) active = k; });
      return { chunk: c, active, age: t - c.t0 };
    }
  }
  return null;
}

export const capText = (w: string) => w.replace(/[.,;:]$/, "").toUpperCase();
export const segsLength = (segs: Seg[]) => segs.reduce((s, x) => s + (x.end - x.start), 0);
