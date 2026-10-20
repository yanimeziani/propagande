#!/usr/bin/env python3
"""One Agent double job: a short scene + a character image in, the scene with the character replaced out.

Pipeline (all open weights, Apache 2.0):
  1. checks      the scene is short enough, the consent record is there
  2. preprocess  official Wan2.2 preprocessing in replacement mode: skeleton (ViTPose), face crops,
                 the person's mask (SAM 2) and the background without them
  3. generate    Wan2.2-Animate-14B, replacement mode, with the relighting LoRA (the new character takes the
                 scene's light)
  4. finish      the original sound put back, and a visible « Modifié par IA » label

Job folder layout (written by server.py):
  scene.mp4  character.png  job.json  →  out.mp4  log.txt  status.json

job.json: {"draft": true, "tap": {"x": 0.5, "y": 0.6, "t": 2.0}, "consent": {...}, "max_seconds": 10}

usage: python3 job.py <job_dir> --root /data/agent-double [--low-vram] [--dry-run]
  --dry-run  runs the plumbing without a GPU: the "result" is the scene itself, labelled. For tests.
"""
import json, os, shutil, subprocess, sys, time

DRAFT = "832 480"
FINAL = "1280 720"
LABEL = "Modifié par IA"


def status(job, state, **extra):
    s = {"state": state, "at": time.time(), **extra}
    json.dump(s, open(os.path.join(job, "status.json"), "w"), ensure_ascii=False)


def log(job, *a):
    line = " ".join(str(x) for x in a)
    print(line, flush=True)
    with open(os.path.join(job, "log.txt"), "a") as f:
        f.write(line + "\n")


def run(job, cmd, cwd=None):
    log(job, "$", " ".join(cmd))
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    with open(os.path.join(job, "log.txt"), "a") as f:
        f.write((r.stdout or "")[-4000:] + (r.stderr or "")[-4000:])
    if r.returncode != 0:
        raise RuntimeError("step failed: %s" % os.path.basename(cmd[1] if len(cmd) > 1 else cmd[0]))


def duration(path):
    if not shutil.which("ffprobe"):
        return None
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def finish(job, generated, scene, out):
    """Original sound back on, and the AI label burned in (bottom right, small, always readable)."""
    if not shutil.which("ffmpeg"):
        log(job, "ffmpeg missing: copying without sound or label (dry-run only)")
        shutil.copy(generated, out)
        return
    run(job, ["ffmpeg", "-y", "-i", generated, "-i", scene, "-map", "0:v:0", "-map", "1:a:0?", "-shortest",
              "-vf", "drawtext=text='%s':fontcolor=white:fontsize=h/34:box=1:boxcolor=black@0.55:boxborderw=8:x=w-tw-24:y=h-th-24" % LABEL,
              "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-b:a", "192k", out])


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); return
    job = os.path.abspath(a[0])
    root = os.path.abspath(a[a.index("--root") + 1]) if "--root" in a else "/data/agent-double"
    dry = "--dry-run" in a
    low = "--low-vram" in a
    spec = json.load(open(os.path.join(job, "job.json")))
    scene, ref = os.path.join(job, "scene.mp4"), os.path.join(job, "character.png")
    out = os.path.join(job, "out.mp4")
    try:
        status(job, "checks")
        for f in (scene, ref):
            if not os.path.isfile(f):
                raise RuntimeError("missing %s" % os.path.basename(f))
        c = spec.get("consent") or {}
        if not c.get("own_video") or (c.get("character") == "real" and not c.get("real_person_consent")):
            raise RuntimeError("consent record incomplete")
        d = duration(scene)
        if d and d > float(spec.get("max_seconds", 10)) + 0.5:
            raise RuntimeError("scene too long (%.1f s)" % d)

        if dry:
            status(job, "generate", note="dry-run")
            finish(job, scene, scene, out)
            status(job, "done", dry_run=True)
            log(job, "dry-run done")
            return

        wan = os.path.join(root, "Wan2.2")
        ckpt = os.path.join(root, "Wan2.2-Animate-14B")
        py = os.path.join(root, "venv", "bin", "python")
        work = os.path.join(job, "process_results")
        res = DRAFT if spec.get("draft", True) else FINAL

        status(job, "preprocess")
        run(job, [py, "./wan/modules/animate/preprocess/preprocess_data.py",
                  "--ckpt_path", os.path.join(ckpt, "process_checkpoint"),
                  "--video_path", scene, "--refer_path", ref, "--save_path", work,
                  "--resolution_area", *res.split(), "--iterations", "3", "--k", "7", "--w_len", "1", "--h_len", "1",
                  "--replace_flag"], cwd=wan)

        status(job, "generate")
        generated = os.path.join(job, "generated.mp4")
        cmd = [py, "generate.py", "--task", "animate-14B", "--ckpt_dir", ckpt, "--src_root_path", work,
               "--refert_num", "1", "--replace_flag", "--use_relighting_lora", "--save_file", generated]
        if low:
            cmd += ["--offload_model", "True", "--convert_model_dtype", "--t5_cpu"]
        run(job, cmd, cwd=wan)

        status(job, "finish")
        finish(job, generated, scene, out)
        status(job, "done")
        log(job, "done")
    except Exception as e:  # the page shows this line as is
        status(job, "failed", error=str(e))
        log(job, "failed:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
