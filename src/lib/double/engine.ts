/** Talks to the Agent double GPU server (engine/agent_double/server.py). The server's address comes from the
 *  build (NEXT_PUBLIC_DOUBLE_ENGINE) or, for testing a new server, from this browser's localStorage
 *  (« ml-double-engine »). Access needs a code the server knows; no secret is shipped in the site. */

export type JobState = "queued" | "checks" | "preprocess" | "generate" | "finish" | "done" | "failed";
export type JobStatus = { state: JobState; position?: number; error?: string; dry_run?: boolean };
export type JobSpec = {
  draft: boolean;
  tap: { x: number; y: number; t: number };
  consent: { own_video: boolean; character: "ai" | "real"; real_person_consent?: boolean; at: string };
  max_seconds: number;
  track_coverage: number;
};

export function engineUrl(): string | null {
  let local: string | null = null;
  try { local = localStorage.getItem("ml-double-engine"); } catch { /* storage blocked */ }
  const url = local || process.env.NEXT_PUBLIC_DOUBLE_ENGINE || "";
  return url ? url.replace(/\/$/, "") : null;
}

const b64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** The character image as a PNG, at most 1024 px on its long side. */
async function characterPng(src: string): Promise<ArrayBuffer> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = new OffscreenCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return (await c.convertToBlob({ type: "image/png" })).arrayBuffer();
}

async function call(base: string, code: string, path: string, init?: RequestInit) {
  const r = await fetch(base + path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${code}`, "Content-Type": "application/json" } });
  if (r.status === 401) throw new Error("Code d'accès refusé.");
  if (!r.ok && r.status !== 202) throw new Error((await r.json().catch(() => ({}))).error ?? `Erreur ${r.status}`);
  return r;
}

export async function submitJob(base: string, code: string, sceneUrl: string, characterUrl: string, spec: JobSpec): Promise<string> {
  const scene = await (await fetch(sceneUrl)).arrayBuffer();
  const character = await characterPng(characterUrl);
  const r = await call(base, code, "/jobs", { method: "POST", body: JSON.stringify({ scene: b64(scene), character: b64(character), spec }) });
  return (await r.json()).id as string;
}

export async function jobStatus(base: string, code: string, id: string): Promise<JobStatus> {
  return (await call(base, code, `/jobs/${encodeURIComponent(id)}`)).json();
}

export async function jobResult(base: string, code: string, id: string): Promise<Blob> {
  return (await call(base, code, `/jobs/${encodeURIComponent(id)}/out.mp4`)).blob();
}

export const STATE_TEXT: Record<JobState, string> = {
  queued: "En file d'attente…",
  checks: "Vérifications…",
  preprocess: "Lecture des mouvements et du visage…",
  generate: "Le nouveau personnage prend sa place…",
  finish: "Son d'origine et mention IA…",
  done: "Prêt.",
  failed: "Échec.",
};
