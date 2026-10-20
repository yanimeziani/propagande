#!/usr/bin/env python3
"""Propagande v1, the local engine: a long video in, ready-to-post 9:16 clips out.

Steps (each cached in <out>/work):
  1. audio     the audio track as 16 kHz mono WAV (bin/extract-audio, AVFoundation)
  2. words     French transcript with word timestamps (whisper.cpp, large-v3-turbo)
  3. sentences words grouped into sentences (punctuation, or a pause > 0.7 s)
  4. moments   every sentence-bounded window of --min..--max s, scored on its hook, its ending,
               loudness and speech rate; the best non-overlapping ones are kept, with reasons
  5. render    each moment cut at sentence edges, face-centred 9:16, captions burned in
               (bin/render-clip, AVFoundation + Vision)

usage: python3 engine/propagande.py <video> [--out DIR] [--clips 8] [--min 20] [--max 45] [--lang fr] [--no-render]
"""
import array, hashlib, json, math, os, re, subprocess, sys, wave

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(HERE, "bin")
WHISPER = os.path.expanduser("~/.local/bin/whisper-cli")
MODEL = os.path.expanduser("~/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin")

HOOK_WORDS = set("""pourquoi comment personne jamais toujours secret vérité erreur argent piège arrête attention voici
voilà imagine regarde personne problème gratuit million milliard mille fou folie choc interdit illégal truc
why how never nobody secret truth mistake money stop look imagine free crazy""".split())
YOU = {"tu", "toi", "ton", "ta", "tes", "vous", "votre", "vos", "you", "your"}
DANGLING = {"et", "mais", "ou", "donc", "parce", "que", "qui", "de", "du", "des", "le", "la", "les", "un", "une", "à", "en", "pour", "avec", "sur"}


def log(*a):
    print(*a, flush=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("failed: %s\n%s" % (" ".join(cmd[:2]), (r.stderr or r.stdout)[-800:]))
    return r.stdout


# ---------------------------------------------------------------- 1-2. audio + words
def extract(video, work):
    wav = os.path.join(work, "audio.wav")
    if not os.path.exists(wav):
        log("1. audio  ", run([os.path.join(BIN, "extract-audio"), video, wav]).strip())
    return wav


def transcribe(wav, work, lang):
    out = os.path.join(work, "words" if lang == "fr" else "words-" + lang)  # one cache per language setting
    if not os.path.exists(out + ".json"):
        log("2. words   whisper.cpp large-v3-turbo (%s)…" % lang)
        run([WHISPER, "-m", MODEL, "-f", wav, "-l", lang, "-ml", "1", "-sow", "-oj", "-of", out, "-t", str(os.cpu_count() or 8), "-np"])
    data = json.load(open(out + ".json", encoding="utf-8", errors="ignore"))
    words = []
    for seg in data.get("transcription", []):
        txt = seg.get("text", "").strip()
        if not txt or txt.startswith("["):
            continue
        t0, t1 = seg["offsets"]["from"] / 1000, seg["offsets"]["to"] / 1000
        words.append({"t0": t0, "t1": max(t1, t0 + 0.05), "w": txt})
    log("2. words   %d words" % len(words))
    return words


# ---------------------------------------------------------------- 3. sentences
def sentences(words):
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        end_punct = re.search(r"[.!?…]$", w["w"]) is not None
        pause = nxt is not None and nxt["t0"] - w["t1"] > 0.7
        if end_punct or pause or nxt is None:
            out.append({"t0": cur[0]["t0"], "t1": cur[-1]["t1"], "words": cur, "text": " ".join(x["w"] for x in cur),
                        "closed": end_punct})
            cur = []
    return out


# ---------------------------------------------------------------- loudness
def envelope(wav, hop=0.25):
    with wave.open(wav) as w:
        sr, n = w.getframerate(), w.getnframes()
        data = array.array("h", w.readframes(n))
    H = int(sr * hop)
    env = []
    for i in range(0, len(data) - H, H):
        s = 0
        for k in range(i, i + H, 4):
            s += data[k] * data[k]
        env.append(math.sqrt(s / (H / 4)) / 32768)
    return env, hop


def zstats(env):
    m = sum(env) / len(env)
    sd = math.sqrt(sum((v - m) ** 2 for v in env) / len(env)) or 1
    return [(v - m) / sd for v in env]


# ---------------------------------------------------------------- 4. moments
def norm(w):
    return re.sub(r"[^\wà-ÿ$%]", "", w.lower())


def score_window(sents, z, hop):
    first = sents[0]
    fw = [norm(w["w"]) for w in first["words"]]
    allw = [norm(w["w"]) for s in sents for w in s["words"]]
    t0, t1 = sents[0]["t0"], sents[-1]["t1"]
    dur = t1 - t0
    reasons, s = [], 0.0
    if first["text"].rstrip().endswith("?"):
        s += 1.2; reasons.append("Question en ouverture")
    if any(re.search(r"\d", w) for w in fw) or any(w in ("million", "milliard", "mille", "%", "$") for w in fw):
        s += 1.0; reasons.append("Chiffre dans la première phrase")
    if any(w in YOU for w in fw):
        s += 0.6; reasons.append("Parle directement à « tu »")
    if any(w in HOOK_WORDS for w in fw):
        s += 0.8; reasons.append("Mot accrocheur au début")
    if len(fw) <= 12:
        s += 0.5; reasons.append("Première phrase courte")
    nums = sum(1 for w in allw if re.search(r"\d", w))
    if nums >= 2:
        s += 0.4; reasons.append("Plusieurs chiffres")
    last = sents[-1]
    lw = norm(last["words"][-1]["w"]) if last["words"] else ""
    if last["closed"] and lw not in DANGLING:
        s += 0.7; reasons.append("Finit sur une phrase complète")
    else:
        s -= 0.8
    if last["text"].rstrip().endswith("!"):
        s += 0.3
    a, b = int(t0 / hop), max(int(t0 / hop) + 1, int(t1 / hop))
    seg = z[a:b] or [0]
    mean = sum(seg) / len(seg)
    spread = math.sqrt(sum((v - mean) ** 2 for v in seg) / len(seg))
    s += 0.6 * mean + 0.4 * spread
    if mean > 0.5:
        reasons.append("Énergie haute")
    rate = len(allw) / max(1, dur)
    if rate < 1.6:
        s -= 0.6
    elif rate > 2.4:
        s += 0.3; reasons.append("Débit rapide")
    return s, reasons


def pick(sents, z, hop, n, lo, hi):
    cands = []
    for i in range(len(sents)):
        for j in range(i, len(sents)):
            dur = sents[j]["t1"] - sents[i]["t0"]
            if dur > hi:
                break
            if dur >= lo:
                sc, why = score_window(sents[i:j + 1], z, hop)
                cands.append((sc, i, j, why))
    cands.sort(key=lambda c: -c[0])
    chosen = []
    for sc, i, j, why in cands:
        a, b = sents[i]["t0"], sents[j]["t1"]
        if all(b <= c["start"] or a >= c["end"] for c in chosen):
            chosen.append({"start": round(max(0, a - 0.15), 2), "end": round(b + 0.35, 2), "score": round(sc, 2), "why": why,
                           "hook": sents[i]["text"], "text": " ".join(s["text"] for s in sents[i:j + 1]), "i": i, "j": j})
        if len(chosen) >= n:
            break
    return sorted(chosen, key=lambda c: c["start"])


# ---------------------------------------------------------------- captions
def captions(words, start, end, max_words=3, max_chars=18):
    """Punchy chunks of 2-4 words, timed to the words, relative to the clip start."""
    ws = [w for w in words if w["t0"] >= start - 0.05 and w["t1"] <= end + 0.05]
    out, cur = [], []
    for k, w in enumerate(ws):
        cur.append(w)
        text = " ".join(x["w"] for x in cur)
        nxt = ws[k + 1] if k + 1 < len(ws) else None
        hard = re.search(r"[.!?…,:;]$", w["w"]) is not None
        if len(cur) >= max_words or len(text) >= max_chars or hard or nxt is None or (nxt and nxt["t0"] - w["t1"] > 0.5):
            t0 = cur[0]["t0"] - start
            t1 = (nxt["t0"] - start) if nxt and nxt["t0"] - w["t1"] < 0.5 else (w["t1"] - start + 0.15)
            out.append({"t0": round(max(0, t0), 3), "t1": round(max(t0 + 0.1, t1), 3), "text": re.sub(r"[.,;:]$", "", text)})
            cur = []
    # whisper can give several words the same time at segment edges: keep chunks in order, never overlapping
    for k in range(1, len(out)):
        out[k]["t0"] = max(out[k]["t0"], out[k - 1]["t1"])
        out[k]["t1"] = round(max(out[k]["t1"], out[k]["t0"] + 0.3), 3)
    for k in range(len(out) - 1):
        out[k]["t1"] = min(out[k]["t1"], out[k + 1]["t0"])
    return out


# ---------------------------------------------------------------- main
def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        print(__doc__); return
    video = os.path.abspath(a[0])
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    n, lo, hi, lang = opt("--clips", 8), opt("--min", 20.0), opt("--max", 45.0), opt("--lang", "fr")
    out = os.path.abspath(opt("--out", os.path.splitext(video)[0] + "-propagande"))
    key = hashlib.sha1(("%s:%d" % (video, os.path.getsize(video))).encode()).hexdigest()[:10]
    work = os.path.join(out, "work", key)
    os.makedirs(work, exist_ok=True)

    wav = extract(video, work)
    words = transcribe(wav, work, lang)
    if not words:
        raise SystemExit("No speech found. Propagande v1 needs a video where someone talks.")
    sents = sentences(words)
    log("3. sentences %d" % len(sents))
    env, hop = envelope(wav)
    moments = pick(sents, zstats(env), hop, n, lo, hi)
    log("4. moments %d" % len(moments))
    json.dump({"video": video, "words": len(words), "sentences": len(sents), "moments": moments},
              open(os.path.join(out, "moments.json"), "w"), ensure_ascii=False, indent=1)
    with open(os.path.join(out, "transcript.txt"), "w") as f:
        for s in sents:
            f.write("[%s] %s\n" % (fmt(s["t0"]), s["text"]))

    for k, m in enumerate(moments, 1):
        log("   #%d %s–%s  score %.2f  %s\n      « %s »" % (k, fmt(m["start"]), fmt(m["end"]), m["score"], " · ".join(m["why"]), m["hook"][:90]))
        caps = captions(words, m["start"], m["end"])
        cap_path = os.path.join(work, "caps-%02d.json" % k)
        json.dump(caps, open(cap_path, "w"), ensure_ascii=False)
        if "--no-render" not in a:
            dst = os.path.join(out, "propagande-%02d.mp4" % k)
            log("      " + run([os.path.join(BIN, "render-clip"), video, dst, str(m["start"]), str(m["end"]), cap_path]).strip())
    log("done → %s" % out)


def fmt(t):
    return "%d:%02d" % (int(t) // 60, int(t) % 60)


if __name__ == "__main__":
    main()
