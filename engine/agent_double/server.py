#!/usr/bin/env python3
"""Agent double GPU server: receives jobs from the website, runs them one at a time, serves the results.
Standard library only.

  POST /jobs             {"scene": base64 mp4, "character": base64 png/jpg, "spec": {...}}  → {"id": "..."}
  GET  /jobs/<id>        → status.json  {"state": checks|preprocess|generate|finish|done|failed, ...}
  GET  /jobs/<id>/out.mp4

Access: every request carries "Authorization: Bearer <code>", where <code> is one line of the --codes file
(one code per Pro member or tester, revoke by deleting the line). Nothing secret ships in the website.

usage: python3 server.py --root /data/agent-double --codes codes.txt [--port 8787] [--origin https://madelucid.com]
       [--low-vram] [--dry-run]
Put it behind HTTPS (Caddy or Traefik) before the website talks to it.
"""
import base64, json, os, queue, secrets, subprocess, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_BODY = 80 * 1024 * 1024  # a 10 s scene at phone quality fits easily


def opt(name, default=None):
    a = sys.argv
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


ROOT = os.path.abspath(opt("--root", "/data/agent-double"))
JOBS = os.path.join(ROOT, "jobs")
CODES = opt("--codes", os.path.join(ROOT, "codes.txt"))
ORIGIN = opt("--origin", "https://madelucid.com")
PORT = int(opt("--port", "8787"))
EXTRA = [x for x in ("--low-vram", "--dry-run") if x in sys.argv]
os.makedirs(JOBS, exist_ok=True)
work = queue.Queue()


def codes():
    try:
        return {l.strip() for l in open(CODES) if l.strip() and not l.startswith("#")}
    except FileNotFoundError:
        return set()


def runner():
    while True:
        jid = work.get()
        job = os.path.join(JOBS, jid)
        subprocess.run([sys.executable, os.path.join(HERE, "job.py"), job, "--root", ROOT, *EXTRA])
        work.task_done()


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self):
        auth = self.headers.get("Authorization", "")
        ok = auth.startswith("Bearer ") and auth[7:].strip() in codes()
        if not ok:
            self._json(401, {"error": "code d'accès invalide"})
        return ok

    def log_message(self, fmt, *args):  # no request logs with codes or file names
        sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/jobs" or not self._authed():
            return
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            return self._json(413, {"error": "fichier trop gros"})
        try:
            req = json.loads(self.rfile.read(n))
            scene = base64.b64decode(req["scene"])
            char = base64.b64decode(req["character"])
            spec = req.get("spec") or {}
        except Exception:
            return self._json(400, {"error": "requête illisible"})
        jid = time.strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(4)
        job = os.path.join(JOBS, jid)
        os.makedirs(job)
        open(os.path.join(job, "scene.mp4"), "wb").write(scene)
        open(os.path.join(job, "character.png"), "wb").write(char)
        spec["received_at"] = time.time()
        json.dump(spec, open(os.path.join(job, "job.json"), "w"), ensure_ascii=False)
        json.dump({"state": "queued", "position": work.qsize() + 1}, open(os.path.join(job, "status.json"), "w"))
        work.put(jid)
        self._json(202, {"id": jid})

    def do_GET(self):
        parts = self.path.strip("/").split("/")
        if len(parts) < 2 or parts[0] != "jobs" or not self._authed():
            return self._json(404, {"error": "introuvable"}) if parts[:1] != ["jobs"] else None
        jid = os.path.basename(parts[1])
        job = os.path.join(JOBS, jid)
        if not os.path.isdir(job):
            return self._json(404, {"error": "introuvable"})
        if len(parts) == 2:
            return self._json(200, json.load(open(os.path.join(job, "status.json"))))
        if parts[2] == "out.mp4" and os.path.isfile(os.path.join(job, "out.mp4")):
            data = open(os.path.join(job, "out.mp4"), "rb").read()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self._json(404, {"error": "pas encore prêt"})


if __name__ == "__main__":
    threading.Thread(target=runner, daemon=True).start()
    print("Agent double server on :%d, jobs in %s, %d access code(s)%s" % (PORT, JOBS, len(codes()), " (dry-run)" if "--dry-run" in EXTRA else ""), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
