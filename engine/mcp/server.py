#!/usr/bin/env python3
"""Propagande MCP server: Claude edits, your machine cuts. 0 $ per clip, nothing uploaded.

A Model Context Protocol server over stdio, standard library only. It drives the local engine
(../propagande.py: whisper.cpp + AVFoundation/Vision) so Claude can:
  1. check_setup     see what's installed and what's missing
  2. analyze_video   get the timed transcript (numbered sentences) and the engine's own suggested moments
  3. render_clips    render the moments Claude chose as 9:16 MP4s with burned-in word captions, a style
                     (caption look, framing rhythm, punch-ins on key words), optional cold open and music on the beat
  4. measure_reference  turn a reference (a short you like, or a Pinterest/Dribbble design shot) into a style

Register it (Claude Code):  claude mcp add propagande -- python3 /absolute/path/engine/mcp/server.py
macOS only for now: rendering uses AVFoundation and Vision.
"""
import json, os, re, shutil, subprocess, sys, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)
import propagande as eng  # noqa: E402
import taste  # noqa: E402

# stdout carries the protocol: every engine log line goes to stderr instead
eng.log = lambda *a: print(*a, file=sys.stderr, flush=True)

PROTOCOL = "2025-06-18"
SERVER = {"name": "propagande", "version": "0.1.0"}

TOOLS = [
    {
        "name": "check_setup",
        "description": "Check that the local Propagande engine can run on this machine (macOS, whisper.cpp, the Whisper model, the Swift render tools). Call this first if another tool fails.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "analyze_video",
        "description": (
            "Transcribe a local video on this machine (whisper.cpp large-v3-turbo, nothing uploaded) and return its numbered, "
            "timed sentences plus the engine's suggested clip moments with reasons. Cached: a second call on the same file is instant. "
            "Use the sentence numbers and times to choose moments, then call render_clips."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "video": {"type": "string", "description": "Absolute path to a local video file (MP4, MOV)."},
                "language": {"type": "string", "description": "Whisper language code, e.g. 'fr', 'en', or 'auto' (default).", "default": "auto"},
                "suggestions": {"type": "integer", "description": "How many moments the engine should suggest (default 8).", "default": 8},
                "min_seconds": {"type": "number", "default": 20},
                "max_seconds": {"type": "number", "default": 45},
            },
            "required": ["video"],
            "additionalProperties": False,
        },
    },
    {
        "name": "render_clips",
        "description": (
            "Render chosen moments of an analyzed video as vertical 9:16 MP4 clips (1080x1920) with word-by-word captions burned in "
            "and the crop centred on the speaker's face. Runs locally, faster than real time. Each clip is a [start, end] range in "
            "seconds, ideally cut on sentence edges from analyze_video. Optional cold open: a [start, end] range inside the clip "
            "(one of its own sentences) played first, then the whole clip from its start. A style sets the caption look (the spoken "
            "word lit in an accent colour), a framing rhythm like a two-camera edit, and punch-in zooms on key words (numbers, "
            "strong words, loud moments). With music, the track sits under the voice, starts so a beat lands on the cold-open cut, "
            "and framing changes snap to its beats. Built-in styles: propagande, podcast-calme, hype. Returns the output file paths."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "video": {"type": "string", "description": "The same absolute path given to analyze_video."},
                "language": {"type": "string", "default": "auto"},
                "clips": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "start": {"type": "number"},
                            "end": {"type": "number"},
                            "title": {"type": "string", "description": "Short name used in the file name."},
                            "cold_open": {
                                "type": "object",
                                "properties": {"start": {"type": "number"}, "end": {"type": "number"}},
                                "required": ["start", "end"],
                            },
                        },
                        "required": ["start", "end"],
                    },
                },
                "captions": {"type": "boolean", "default": True},
                "style": {"type": "string", "description": "A style name (see the list in this tool's description, or one saved by measure_reference) or a path to a style JSON. Default 'propagande'.", "default": "propagande"},
                "music": {"type": "string", "description": "Optional absolute path to a music track the user has the right to use. It's laid under the voice, and framing changes land on its beats."},
                "out_dir": {"type": "string", "description": "Where to write the clips (default: <video name>-propagande next to the video)."},
            },
            "required": ["video", "clips"],
            "additionalProperties": False,
        },
    },
]


# ---------------------------------------------------------------- engine glue
def work_dir(video, out):
    import hashlib
    key = hashlib.sha1(("%s:%d" % (video, os.path.getsize(video))).encode()).hexdigest()[:10]
    w = os.path.join(out, "work", key)
    os.makedirs(w, exist_ok=True)
    return w


def default_out(video):
    return os.path.splitext(video)[0] + "-propagande"


def need_file(path):
    p = os.path.abspath(os.path.expanduser(path or ""))
    if not os.path.isfile(p):
        raise ValueError("No file at %s. Give the absolute path of a local video." % p)
    return p


def load(video, language):
    out = default_out(video)
    work = work_dir(video, out)
    wav = eng.extract(video, work)
    words = eng.transcribe(wav, work, language or "auto")
    return out, work, wav, words


def music_beats(music, work):
    """Beat grid of the music track (cached per file)."""
    import hashlib
    key = hashlib.sha1(("%s:%d" % (music, os.path.getsize(music))).encode()).hexdigest()[:10]
    cache = os.path.join(work, "beats-%s.json" % key)
    if os.path.exists(cache):
        d = json.load(open(cache))
        return d["beats"], d["bpm"]
    wav = os.path.join(work, "music-%s.wav" % key)
    if not os.path.exists(wav):
        eng.run([os.path.join(eng.BIN, "extract-audio"), music, wav])
    beats, bpm = taste.detect_beats(wav)
    json.dump({"beats": beats, "bpm": bpm}, open(cache, "w"))
    return beats, bpm


def detected_language(work, language):
    if language not in (None, "", "auto"):
        return language
    try:
        data = json.load(open(os.path.join(work, "words-auto.json"), encoding="utf-8", errors="ignore"))
        return data.get("result", {}).get("language") or "auto"
    except Exception:
        return "auto"


def check_setup(_args):
    rows = []
    ok = True
    def item(name, good, fix):
        nonlocal ok
        ok = ok and good
        rows.append("%s %s%s" % ("OK " if good else "MISSING", name, "" if good else "  →  " + fix))
    item("macOS", sys.platform == "darwin", "Rendering uses AVFoundation and Vision; it runs on macOS only for now.")
    item("whisper-cli (%s)" % eng.WHISPER, os.path.isfile(eng.WHISPER), "Build whisper.cpp (https://github.com/ggml-org/whisper.cpp) and put whisper-cli at that path.")
    item("Whisper model (%s)" % eng.MODEL, os.path.isfile(eng.MODEL), "Download ggml-large-v3-turbo-q5_0.bin from the whisper.cpp model list into that path.")
    for tool in ("extract-audio", "render-clip", "join-clips", "reference"):
        item("engine/bin/%s" % tool, os.path.isfile(os.path.join(eng.BIN, tool)), "Run engine/setup.sh (builds the Swift tools with swiftc).")
    rows.append("")
    rows.append("Ready." if ok else "Not ready: fix the MISSING lines, then call check_setup again.")
    return "\n".join(rows)


def analyze_video(args):
    video = need_file(args.get("video"))
    language = args.get("language") or "auto"
    out, work, wav, words = load(video, language)
    if not words:
        return "No speech found in this video. Propagande clips videos where someone talks."
    sents = eng.sentences(words)
    env, hop = eng.envelope(wav)
    moments = eng.pick(sents, eng.zstats(env), hop, int(args.get("suggestions") or 8),
                       float(args.get("min_seconds") or 20), float(args.get("max_seconds") or 45))
    duration = len(env) * hop
    lines = [
        "Video: %s" % video,
        "Duration: %s · %d sentences · language: %s" % (eng.fmt(duration), len(sents), detected_language(work, language)),
        "",
        "SUGGESTED MOMENTS (engine score, best first by time):",
    ]
    for k, m in enumerate(moments, 1):
        lines.append("#%d  %.2f–%.2f s (%s)  sentences %d–%d  score %.2f  [%s]" % (
            k, m["start"], m["end"], eng.fmt(m["end"] - m["start"]), m["i"], m["j"], m["score"], " · ".join(m["why"])))
        lines.append("    opens: « %s »" % m["hook"][:140])
    lines += ["", "TRANSCRIPT (sentence number, start–end in seconds, text):"]
    for i, s in enumerate(sents):
        lines.append("%d  %.2f–%.2f  %s" % (i, s["t0"], s["t1"], s["text"]))
    with open(os.path.join(out, "transcript.txt"), "w") as f:
        for s in sents:
            f.write("[%s] %s\n" % (eng.fmt(s["t0"]), s["text"]))
    return "\n".join(lines)


def slug(t):
    t = re.sub(r"[^\w-]+", "-", (t or "").lower(), flags=re.UNICODE).strip("-")
    return t[:40] or "clip"


def render_one(video, dst, start, end, words, work, captions, tag, style, z, hop, beats=None, punch_first=False):
    caps = taste.caption_plan(words, start, end, style) if captions else []
    cap_path = os.path.join(work, "caps-%s.json" % tag)
    json.dump(caps, open(cap_path, "w"), ensure_ascii=False)
    zooms = taste.zoom_plan(words, start, end, style, z, hop, beats)
    if punch_first and zooms:  # a cold open starts tight: it's the punch line
        zooms[0]["scale"] = style["pacing"]["punch_scale"]
    zoom_path = os.path.join(work, "zooms-%s.json" % tag)
    json.dump(zooms, open(zoom_path, "w"))
    style_path = os.path.join(work, "style-%s.json" % tag)
    json.dump(style, open(style_path, "w"), ensure_ascii=False)
    eng.run([os.path.join(eng.BIN, "render-clip"), video, dst, "%.3f" % start, "%.3f" % end, cap_path,
             "--style", style_path, "--zooms", zoom_path])
    return len(zooms) - 1


def render_clips(args):
    video = need_file(args.get("video"))
    clips = args.get("clips") or []
    if not clips:
        raise ValueError("Give at least one clip: {\"start\": seconds, \"end\": seconds}.")
    out, work, wav, words = load(video, args.get("language") or "auto")
    dest = os.path.abspath(os.path.expanduser(args.get("out_dir") or out))
    os.makedirs(dest, exist_ok=True)
    captions = args.get("captions", True)
    style = taste.load_style(args.get("style"))
    env, hop = eng.envelope(wav)
    z = eng.zstats(env)
    music = args.get("music")
    beats, bpm = ([], 0.0)
    if music:
        music = need_file(music)
        beats, bpm = music_beats(music, work)
    done = []
    for k, c in enumerate(clips, 1):
        start, end = float(c["start"]), float(c["end"])
        if end - start < 3:
            raise ValueError("Clip %d is shorter than 3 s (%.2f–%.2f)." % (k, start, end))
        name = "propagande-%02d-%s.mp4" % (k, slug(c.get("title")))
        dst = os.path.join(dest, name)
        co = c.get("cold_open")
        parts = []  # (start, end, punch_first)
        if co:
            cs, ce = float(co["start"]), float(co["end"])
            if not (start <= cs < ce <= end):
                raise ValueError("Clip %d: the cold open must be inside the clip (one of its own lines)." % k)
            parts.append((cs, ce, True))
        parts.append((start, end, False))
        length = sum(e - s for s, e, _ in parts)
        # music starts so that a beat lands on the cut back after the cold open (or on the first frame)
        head = parts[0][1] - parts[0][0] if co else 0.0
        offset = taste.music_offset(beats, head, length) if beats else 0.0
        clip_beats = taste.beats_in_clip(beats, offset, length) if beats else []
        files, at, changes = [], 0.0, 0
        for n, (s_, e_, punch_first) in enumerate(parts):
            seg_beats = [round(b - at + s_, 3) for b in clip_beats if at <= b <= at + (e_ - s_)]  # in source time
            f = os.path.join(work, "part-%02d-%d.mp4" % (k, n)) if (co or music) else dst
            changes += render_one(video, f, s_, e_, words, work, captions, "%02d-%d" % (k, n), style, z, 0.25, seg_beats, punch_first)
            files.append(f)
            at += e_ - s_
        if co or music:
            cmd = [os.path.join(eng.BIN, "join-clips"), dst] + files
            if music:
                cmd += ["--music", music, "--offset", "%.3f" % offset, "--gain", str(style["music"]["gain"]), "--fade", str(style["music"]["fade"])]
            eng.run(cmd)
        extra = [x for x in ["cold open" if co else "", "music %.0f BPM on the beat" % bpm if music else "", "%d framing changes" % changes] if x]
        done.append("%s  (%s, %s)" % (dst, eng.fmt(length), ", ".join(extra)))
    return "Rendered %d clip(s), 1080x1920, style « %s », on this machine:\n%s" % (len(done), style["name"], "\n".join(done))


def measure_reference(args):
    path = need_file(args.get("reference"))
    name = slug(args.get("name") or os.path.splitext(os.path.basename(path))[0])
    dst = os.path.join(taste.STYLES, "%s.json" % name)
    eng.run([os.path.join(eng.BIN, "reference"), path, dst, "--name", name])
    st = json.load(open(dst))
    c, p, m = st["captions"], st["pacing"], st["measured"]
    lines = ["Saved style « %s » (%s). Use it with render_clips style=\"%s\"." % (name, dst, name), "",
             "Measured from the %s (%d frames, %d caption lines read):" % (m["kind"], m["frames_read"], m["text_lines_seen"])]
    if m.get("median_shot_seconds"):
        lines.append("- rhythm: a cut every %.1f s (median), %.0f cuts a minute → framing change every %.1f s" % (m["median_shot_seconds"], m["cuts_per_minute"], p["shot_seconds"]))
    lines.append("- captions: %s, up to %d words, size %.3f of the width, %d%% from the bottom" % (c["case"], c["max_words"], c["size"], round(c["y"] * 100)))
    lines.append("- colours: text %s%s%s%s" % (c["fill"], ", spoken word %s" % c["active"] if c.get("active") else "", ", outline" if c.get("stroke") else "", ", band %s" % c["box"] if c.get("box") else ""))
    lines.append("- palette: %s" % " ".join(m.get("palette", [])))
    if m["text_lines_seen"] == 0:
        lines.append("No captions found: only the rhythm and palette were measured. Edit the style file to set the caption look.")
    lines.append("")
    lines.append("Only measurements were kept. No pixels, fonts or footage from the reference go into the clips.")
    return "\n".join(lines)


TOOLS.append({
    "name": "measure_reference",
    "description": (
        "Measure a reference the user likes and save it as a reusable style: a short with burned-in captions (its cut rhythm, "
        "caption position, size, case, words per caption, text and highlight colours), or a still image such as a "
        "Pinterest or Dribbble design shot saved locally (its caption or headline look and its palette). Only measurements are "
        "kept, never the reference's pixels. Returns the style name to pass to render_clips."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "reference": {"type": "string", "description": "Absolute path to a local video or image."},
            "name": {"type": "string", "description": "A short name for the style."},
        },
        "required": ["reference"],
        "additionalProperties": False,
    },
})


HANDLERS = {"measure_reference": measure_reference, "check_setup": check_setup, "analyze_video": analyze_video, "render_clips": render_clips}


# ---------------------------------------------------------------- JSON-RPC over stdio
def send(msg):
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(req):
    method, rid = req.get("method"), req.get("id")
    if method == "initialize":
        version = (req.get("params") or {}).get("protocolVersion") or PROTOCOL
        return {"protocolVersion": version, "capabilities": {"tools": {}}, "serverInfo": SERVER,
                "instructions": "Local video clipping. Call analyze_video on a file path, choose moments on sentence edges, then render_clips. Everything runs on this machine."}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        p = req.get("params") or {}
        fn = HANDLERS.get(p.get("name"))
        if not fn:
            raise LookupError("Unknown tool: %s" % p.get("name"))
        try:
            text = fn(p.get("arguments") or {})
            return {"content": [{"type": "text", "text": text}], "isError": False}
        except BaseException as e:  # engine failures raise SystemExit with a readable message
            if isinstance(e, KeyboardInterrupt):
                raise
            traceback.print_exc(file=sys.stderr)
            return {"content": [{"type": "text", "text": "Propagande error: %s" % (str(e) or e.__class__.__name__)}], "isError": True}
    if rid is None:
        return None  # a notification (e.g. notifications/initialized): no reply
    raise LookupError("Method not found: %s" % method)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            continue
        rid = req.get("id")
        try:
            result = handle(req)
            if rid is not None and result is not None:
                send({"jsonrpc": "2.0", "id": rid, "result": result})
        except LookupError as e:
            if rid is not None:
                send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": str(e)}})
        except Exception as e:
            if rid is not None:
                send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32603, "message": str(e)}})


if __name__ == "__main__":
    main()
