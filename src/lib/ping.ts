/** Anonymous counts for the Monday scorecard, with no third party and no identifier.
 *  Each event is a GET for a tiny static file on our own server (public/e/<event>.txt); the scorecard is the
 *  count of each path in the web server's access log. Nothing about the visitor or the video is sent.
 *  « return-w2 » is decided on the device: the first-clip date stays in this browser's localStorage. */

export type Ev = "open" | "device-gpu" | "device-cpu" | "voice-yes" | "voice-no" | "voice-fail" | "clips-ready" | "export" | "export-fail" | "first-clip" | "return-w2" | "from-endcard" | "error";

export function ping(ev: Ev) {
  if (typeof window === "undefined" || location.hostname === "localhost") return;
  fetch(`/e/${ev}.txt`, { cache: "no-store", keepalive: true }).catch(() => {});
}

const KEY = "ml-first-clip";
const WEEK = 7 * 24 * 3600 * 1000;

/** Call when a clip is exported: counts first clips, and clips made 7 to 14 days after the first one. */
export function pingClipMade() {
  ping("export");
  try {
    const first = Number(localStorage.getItem(KEY) || 0);
    if (!first) {
      localStorage.setItem(KEY, String(Date.now()));
      ping("first-clip");
      return;
    }
    const age = Date.now() - first;
    const sentKey = `${KEY}-w2`;
    if (age >= WEEK && age < 2 * WEEK && !localStorage.getItem(sentKey)) {
      localStorage.setItem(sentKey, "1");
      ping("return-w2");
    }
  } catch {
    /* storage blocked: only the export is counted */
  }
}
