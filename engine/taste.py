"""The taste layer: turns a clip's words, its loudness, a style preset and (optionally) a music track's beats
into an edit plan the renderer follows. Standard library only.

  load_style(name_or_path)            a preset from engine/styles/ or a JSON file
  caption_plan(words, a, b, style)    caption chunks with per-word timing, relative to the clip start
  zoom_plan(words, a, b, style, ...)  framing changes: a 2-camera rhythm plus punch-ins on key words, snapped to beats
  detect_beats(wav)                   beat times and tempo of a music track (energy onsets + autocorrelation)
  music_offset(beats, at)             where to start the track so a beat lands exactly on a given moment
"""
import array, json, math, os, re, wave

HERE = os.path.dirname(os.path.abspath(__file__))
STYLES = os.path.join(HERE, "styles")

HOOK = set("""pourquoi comment personne jamais toujours secret vérité erreur argent piège arrête attention voici voilà
imagine regarde problème gratuit million milliard mille fou folie choc interdit illégal truc seul vrai faux
why how never nobody secret truth mistake money stop look imagine free crazy only real fake""".split())
NUM = {"million", "milliard", "mille", "cent", "%", "$", "zéro", "zero", "thousand", "hundred", "billion"}


def norm(w):
    return re.sub(r"[^\w$%]", "", w.lower())


def load_style(name):
    name = name or "propagande"
    path = name if os.path.isfile(name) else os.path.join(STYLES, "%s.json" % name)
    if not os.path.isfile(path):
        raise ValueError("Unknown style « %s ». Available: %s" % (name, ", ".join(list_styles())))
    s = json.load(open(path))
    base = json.load(open(os.path.join(STYLES, "propagande.json")))
    for k in ("captions", "pacing", "music"):  # missing keys fall back to the default preset
        base[k].update(s.get(k) or {})
    base["name"], base["label"] = s.get("name", name), s.get("label", "")
    return base


def list_styles():
    return sorted(f[:-5] for f in os.listdir(STYLES) if f.endswith(".json"))


# ---------------------------------------------------------------- captions
def caption_plan(words, a, b, style):
    """Chunks of words for the clip [a, b], each with its words' own times, so the renderer can light
    the word being said. Times are relative to the clip start."""
    c = style["captions"]
    mw, mc = int(c.get("max_words", 3)), int(c.get("max_chars", 18))
    ws = [w for w in words if w["t0"] >= a - 0.05 and w["t1"] <= b + 0.05]
    out, cur = [], []
    for k, w in enumerate(ws):
        cur.append(w)
        nxt = ws[k + 1] if k + 1 < len(ws) else None
        text = " ".join(x["w"] for x in cur)
        if len(cur) >= mw or len(text) >= mc or re.search(r"[.!?…,:;]$", w["w"]) or nxt is None or nxt["t0"] - w["t1"] > 0.5:
            t1 = (nxt["t0"] if nxt and nxt["t0"] - w["t1"] < 0.5 else w["t1"] + 0.15)
            out.append({"t0": cur[0]["t0"] - a, "t1": t1 - a,
                        "words": [{"w": re.sub(r"[.,;:]$", "", x["w"]), "t0": x["t0"] - a, "t1": x["t1"] - a} for x in cur]})
            cur = []
    for k in range(1, len(out)):  # never overlap, never go backwards
        out[k]["t0"] = max(out[k]["t0"], out[k - 1]["t0"] + 0.05)
    for k in range(len(out) - 1):
        out[k]["t1"] = min(out[k]["t1"], out[k + 1]["t0"])
    for ch in out:
        ch["t0"] = max(0.0, round(ch["t0"], 3))
        ch["t1"] = round(max(ch["t0"] + 0.1, ch["t1"]), 3)
        ch["text"] = " ".join(x["w"] for x in ch["words"])
    return out


# ---------------------------------------------------------------- framing
def keyword_score(w, z_at):
    n = norm(w["w"])
    s = 0.0
    if re.search(r"\d", n) or n in NUM:
        s += 2.0
    if n in HOOK:
        s += 1.5
    if w["w"].endswith(("!", "?")):
        s += 1.0
    s += max(0.0, z_at(w["t0"]) - 0.8)  # louder than usual
    return s


def zoom_plan(words, a, b, style, z=None, hop=0.25, beats=None):
    """Framing over [a, b]: alternate the wide and the tight frame about every `shot_seconds`, only in gaps
    between words (like cutting between two cameras), and punch in on key words. When there's a beat grid,
    every change moves to the nearest beat within 0.3 s, still inside a gap. Returns [{t, scale, ramp}]."""
    p = style["pacing"]
    shot, alt, punch = float(p["shot_seconds"]), float(p["alt_scale"]), float(p["punch_scale"])
    min_gap, kw_gap, ramp = float(p["min_gap"]), float(p["keyword_gap"]), float(p.get("ramp", 0))
    ws = [w for w in words if w["t0"] >= a - 0.05 and w["t1"] <= b + 0.05]
    z_at = (lambda t: z[min(len(z) - 1, max(0, int(t / hop)))]) if z else (lambda t: 0.0)
    gaps = [a] + [(ws[k]["t1"] + ws[k + 1]["t0"]) / 2 for k in range(len(ws) - 1)]

    def snap(t):
        if beats:
            near = min(beats, key=lambda x: abs(x - t))
            if abs(near - t) <= 0.3:
                t = near
        return t

    plan = [{"t": 0.0, "scale": 1.0, "ramp": 0.0}]
    last_change, last_kw, cur = a, a - kw_gap, 1.0
    # punch-ins first: the strongest key words, spaced out
    kws = sorted(((keyword_score(w, z_at), w) for w in ws), key=lambda x: -x[0])
    punches = []
    for s, w in kws:
        if s < 1.5:
            break
        if all(abs(w["t0"] - q) >= kw_gap for q in punches):
            punches.append(w["t0"])
    punches.sort()
    events = []
    for t in punches:
        events.append((snap(max(a, t - 0.05)), punch))
    # the camera rhythm in between
    t = a + shot
    for g in gaps:
        if g >= t and all(abs(g - e[0]) >= min_gap for e in events):
            events.append((snap(g), None))
            t = g + shot
    events.sort()
    for t, s in events:
        if t - last_change < min_gap or t >= b - 0.3:
            continue
        nxt = s if s is not None else (alt if cur == 1.0 else 1.0)
        if nxt == cur:
            continue
        plan.append({"t": round(t - a, 3), "scale": nxt, "ramp": ramp if s is None else min(ramp, 0.15)})
        cur, last_change = nxt, t
    return plan


# ---------------------------------------------------------------- beats
def read_wav(path):
    with wave.open(path) as w:
        sr, n = w.getframerate(), w.getnframes()
        data = array.array("h", w.readframes(n))
    return sr, data


def detect_beats(wav_path, max_seconds=240):
    """Beat times (s) and BPM. Energy onsets every ~23 ms, tempo by autocorrelation between 70 and 180 BPM,
    then the beat phase that best lines up with the onsets."""
    sr, data = read_wav(wav_path)
    hop = 368 if sr == 16000 else int(sr * 0.023)
    n = min(len(data), sr * max_seconds)
    env = []
    for i in range(0, n - hop, hop):
        s = 0
        for k in range(i, i + hop, 2):
            s += data[k] * data[k]
        env.append(math.log1p(s / (hop / 2)))
    if len(env) < 50:
        return [], 0.0
    onset = [0.0] + [max(0.0, env[i] - env[i - 1]) for i in range(1, len(env))]
    m = sum(onset) / len(onset)
    onset = [max(0.0, o - m) for o in onset]
    fps = sr / hop
    # autocorrelation over integer lags (70-180 BPM), then a parabola through the peak for a sub-frame period
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70) + 1
    ac = {}
    for L in range(max(1, lo - 1), hi + 2):
        ac[L] = sum(onset[i] * onset[i - L] for i in range(L, len(onset)))
    def weighted(L):
        bpm = 60 * fps / L
        return ac[L] * (1 + 0.15 * math.exp(-((bpm - 120) / 40) ** 2))  # a slight preference for common tempos
    L = max(range(lo, hi + 1), key=weighted)
    y0, y1, y2 = ac.get(L - 1, 0), ac[L], ac.get(L + 1, 0)
    den = y0 - 2 * y1 + y2
    best_lag = L + (0.5 * (y0 - y2) / den if den else 0.0)
    if best_lag <= 0:
        return [], 0.0
    best_phase, score = 0.0, -1.0
    for ph in range(int(best_lag) + 1):
        sc, t = 0.0, float(ph)
        while t < len(onset):
            sc += onset[int(t)]
            t += best_lag
        if sc > score:
            score, best_phase = sc, float(ph)
    # refine: find the real onset peak near each predicted beat, then fit period and phase by least squares
    pts = []
    t, k = best_phase, 0
    while t < len(onset):
        w = max(1, int(best_lag * 0.15))
        i0, i1 = max(0, int(t) - w), min(len(onset), int(t) + w + 1)
        j = max(range(i0, i1), key=lambda i: onset[i])
        if onset[j] > 0:
            pts.append((k, j))
        t += best_lag
        k += 1
    if len(pts) >= 4:
        n = len(pts)
        sk = sum(p[0] for p in pts); sj = sum(p[1] for p in pts)
        skk = sum(p[0] * p[0] for p in pts); skj = sum(p[0] * p[1] for p in pts)
        slope = (n * skj - sk * sj) / (n * skk - sk * sk)
        if abs(slope - best_lag) < best_lag * 0.05:
            best_lag, best_phase = slope, (sj - slope * sk) / n
    beats, t = [], best_phase
    while t < len(onset):
        if t >= 0:
            beats.append(round(t / fps, 3))
        t += best_lag
    return beats, round(60 * fps / best_lag, 1)


def music_offset(beats, at, length):
    """Where to start the track (s) so that a beat falls exactly at `at` seconds into the clip, with enough
    music left for `length` seconds. Falls back to the first beat."""
    if not beats:
        return 0.0
    for b in beats:
        off = b - at
        if off >= 0 and (beats[-1] - off) >= length * 0.9:
            return round(off, 3)
    return max(0.0, round(beats[0] - at, 3))


def beats_in_clip(beats, offset, length):
    return [round(b - offset, 3) for b in beats if offset <= b <= offset + length]
