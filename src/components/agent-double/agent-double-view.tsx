"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, ImageSquare, UploadSimple, VideoCamera } from "@phosphor-icons/react";
import { ToolHeader } from "@/components/site/tool-header";
import { Button } from "@/components/ui/button";
import { fmtTime } from "@/lib/clips/analyze";
import { takeHandoff } from "@/lib/handoff";
import { coverage, frameAt, trackPerson, type Track, type TrackProgress } from "@/lib/double/track";
import { engineUrl, jobResult, jobStatus, STATE_TEXT, submitJob, type JobStatus } from "@/lib/double/engine";
import { addCreation } from "@/lib/library";
import { HistoryPanel } from "@/components/library/history-panel";

type Target = { x: number; y: number; t: number };
type Who = "ia" | "reelle";

// Every model is open (Apache 2.0). Step 1 runs on your device today; steps 2-5 run on our GPU (Pro).
const STEPS = [
  { k: "suivre", label: "Suivre la personne", detail: "EdgeTAM trace la personne sur chaque image, sur ton appareil." },
  { k: "pose", label: "Pose et visage", detail: "On lit ses mouvements et son visage, image par image." },
  { k: "remplacer", label: "Remplacer", detail: "Wan2.2-Animate peint le nouveau personnage à sa place." },
  { k: "lumiere", label: "Même lumière", detail: "Le module de relighting accorde sa lumière à ta scène." },
  { k: "son", label: "Son et mention IA", detail: "Ton son d'origine, et la mention « modifié par IA »." },
];

/** Agent double: your scene, a new character. Inputs work today; generation waits for the GPU engine. */
export function AgentDoubleView() {
  const [video, setVideo] = useState<{ url: string; name: string } | null>(() => {
    const h = typeof window === "undefined" ? null : takeHandoff("agent-double");
    return h ? { url: URL.createObjectURL(h.file), name: h.file.name } : null;
  });
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [who, setWho] = useState<Who>("ia");
  const [ownVideo, setOwnVideo] = useState(false);
  const [consent, setConsent] = useState(false);
  const [engine] = useState<string | null>(() => (typeof window === "undefined" ? null : engineUrl()));
  const [code, setCode] = useState(() => { try { return typeof window === "undefined" ? "" : localStorage.getItem("ml-double-code") ?? ""; } catch { return ""; } });
  const [job, setJob] = useState<{ id: string; status: JobStatus; draft: boolean; result?: string; error?: string } | null>(null);
  const [tooLong, setTooLong] = useState(false);
  const v = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [tracking, setTracking] = useState<{ p: TrackProgress | null; error?: string } | null>(null);
  const run = useRef<AbortController | null>(null);

  async function follow(src: string, t: Target) {
    run.current?.abort();
    const ctrl = new AbortController();
    run.current = ctrl;
    setTrack(null);
    setTracking({ p: null });
    try {
      const tr = await trackPerson(src, t, (p) => { if (!ctrl.signal.aborted) setTracking({ p }); }, { signal: ctrl.signal });
      if (!ctrl.signal.aborted) { setTrack(tr); setTracking(null); }
    } catch (e) {
      if (!ctrl.signal.aborted) setTracking({ p: null, error: e instanceof Error ? e.message : "Le suivi n'a pas marché." });
    }
  }
  useEffect(() => () => run.current?.abort(), []);

  // Draw the followed person over the video: amber tint, in the area the video actually occupies (object-contain)
  useEffect(() => {
    if (!track) return;
    let raf = 0;
    const tint = new ImageData(track.width, track.height);
    const off = new OffscreenCanvas(track.width, track.height);
    const octx = off.getContext("2d")!;
    let last = -1;
    const draw = () => {
      const el = v.current, cv = overlay.current;
      if (el && cv) {
        const r = el.getBoundingClientRect();
        if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) { cv.width = Math.round(r.width); cv.height = Math.round(r.height); }
        const ctx = cv.getContext("2d")!;
        const f = frameAt(track, el.currentTime);
        const idx = f ? track.frames.indexOf(f) : -1;
        if (idx !== last) {
          last = idx;
          const d = tint.data;
          d.fill(0);
          if (f?.mask) for (let i = 0; i < f.mask.length; i++) if (f.mask[i]) { d[i * 4] = 254; d[i * 4 + 1] = 139; d[i * 4 + 2] = 2; d[i * 4 + 3] = 110; }
          octx.putImageData(tint, 0, 0);
        }
        const scale = Math.min(cv.width / track.width, cv.height / track.height);
        const w = track.width * scale, h = track.height * scale;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(off, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [track]);

  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const ready = !!video && !!image && !!track && ownVideo && (who === "ia" || consent) && !tooLong;
  const busyJob = !!job && !["done", "failed"].includes(job.status.state);

  /** A 480p draft first; the 720p final only once the visitor has seen the draft and said OK. */
  async function generate(draft: boolean) {
    if (!ready || !engine || !video || !image || !target || !track || !code.trim()) return;
    try { localStorage.setItem("ml-double-code", code.trim()); } catch { /* storage blocked */ }
    setJob({ id: "", draft, status: { state: "queued" } });
    try {
      const id = await submitJob(engine, code.trim(), video.url, image.url, {
        draft, tap: target, max_seconds: 10, track_coverage: Math.round(coverage(track) * 100) / 100,
        consent: { own_video: ownVideo, character: who === "ia" ? "ai" : "real", real_person_consent: who === "reelle" ? consent : undefined, at: new Date().toISOString() },
      });
      setJob({ id, draft, status: { state: "queued" } });
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await jobStatus(engine, code.trim(), id);
        setJob((j) => (j ? { ...j, status: st } : j));
        if (st.state === "failed") throw new Error(st.error ?? "La génération a échoué.");
        if (st.state === "done") break;
      }
      const blob = await jobResult(engine, code.trim(), id);
      setJob((j) => (j ? { ...j, result: URL.createObjectURL(blob) } : j));
      await addCreation({ tool: "agent-double", title: `${draft ? "Brouillon" : "Final"} · ${video.name}`, source: video.name, start: 0, end: v.current?.duration ?? 0, ext: "mp4" }, blob).catch(() => {});
    } catch (e) {
      setJob((j) => ({ id: j?.id ?? "", draft, status: { state: "failed" }, error: e instanceof Error ? e.message : "La génération a échoué." }));
    }
  }
  const missing = [!video && "la scène", !target && "la personne à remplacer", !image && "le nouveau personnage", !ownVideo && "tes droits sur la vidéo", who === "reelle" && !consent && "le consentement"].filter(Boolean) as string[];

  function mark(e: React.MouseEvent<HTMLDivElement>) {
    const el = v.current;
    if (!el) return;
    el.pause();
    // the tap in video coordinates: the frame is letterboxed (object-contain) in the element; the controls
    // float over the image, they don't take space
    const el2 = el.getBoundingClientRect();
    const boxH = el2.height;
    const scale = Math.min(el2.width / el.videoWidth, boxH / el.videoHeight);
    const w = el.videoWidth * scale, h = el.videoHeight * scale;
    const x = (e.clientX - el2.left - (el2.width - w) / 2) / w, y = (e.clientY - el2.top - (boxH - h) / 2) / h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const t = { x, y, t: el.currentTime };
    setTarget(t);
    if (video) void follow(video.url, t);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pb-32 md:p-6">
      <ToolHeader tool="agent-double" line="Ta scène, un autre personnage. Même mouvements, même lumière, même son." note="Le suivi de la personne se fait sur ton appareil. La génération arrive bientôt." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* 1. Scene + target */}
        <section className="glass flex min-w-0 flex-col gap-3 rounded-[24px] p-4" aria-labelledby="scene">
          <h2 id="scene" className="flex items-center gap-2 text-[15px] font-semibold"><Step n={1} done={!!track} /> La scène et la personne à remplacer</h2>
          {!video ? (
            <Drop accept="video/*" icon={<VideoCamera size={28} weight="bold" />} title="Dépose ta vidéo" sub="10 secondes ou moins pour commencer. MP4 ou MOV."
              onPick={(f) => { setVideo({ url: URL.createObjectURL(f), name: f.name }); setTarget(null); }} />
          ) : (
            <>
              <div className="relative overflow-hidden rounded-[18px] bg-black">
                <video ref={v} src={video.url} controls playsInline className="block max-h-[60vh] w-full object-contain"
                  onLoadedMetadata={(e) => setTooLong(e.currentTarget.duration > 10.5)} />
                <canvas ref={overlay} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
                <div role="button" tabIndex={0} aria-label="Toucher la personne à remplacer" onClick={mark}
                  onKeyDown={(e) => { if (e.key === "Enter" && v.current) setTarget({ x: 0.5, y: 0.5, t: v.current.currentTime }); }}
                  className="absolute inset-x-0 top-0 bottom-12 cursor-crosshair" />
                {target && (
                  <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}>
                    <span className="block size-10 rounded-full border-[3px] border-corail bg-corail/25 shadow-[0_0_0_6px_color-mix(in_srgb,var(--corail)_25%,transparent)]" />
                  </span>
                )}
              </div>
              <p className="flex items-center gap-2 text-[14px] text-ink-muted">
                <Crosshair size={18} aria-hidden className="shrink-0" />
                <span>{tracking?.error ? <span className="text-rec">{tracking.error}</span>
                  : tracking ? (tracking.p?.stage === "frames" ? `On suit la personne : ${tracking.p.done} images sur ${tracking.p.total}…` : tracking.p?.stage === "model" ? `Préparation du suivi (${Math.round(tracking.p.loaded / 1e6)} Mo sur ${Math.round(tracking.p.total / 1e6) || "…"})…` : "Préparation du suivi…")
                  : track ? <>Personne suivie sur <span className="font-mono tabular">{Math.round(coverage(track) * 100)} %</span> des images. Lance la vidéo pour vérifier ; touche ailleurs pour changer.</>
                  : target ? <>Cible posée à <span className="font-mono tabular">{fmtTime(target.t)}</span>.</> : "Mets sur pause, puis touche la personne à remplacer."}</span>
              </p>
              <button type="button" onClick={() => { run.current?.abort(); setVideo(null); setTarget(null); setTrack(null); setTracking(null); }} className="w-fit text-[14px] font-semibold text-lilas hover:underline">Changer de vidéo</button>
            </>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {/* 2. New character */}
          <section className="glass flex flex-col gap-3 rounded-[24px] p-4" aria-labelledby="perso">
            <h2 id="perso" className="flex items-center gap-2 text-[15px] font-semibold"><Step n={2} done={!!image} /> Le nouveau personnage</h2>
            {image ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="Le nouveau personnage" className="h-28 w-20 rounded-[14px] object-cover" />
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold">{image.name}</p>
                  <button type="button" onClick={() => setImage(null)} className="w-fit text-[14px] font-semibold text-lilas hover:underline">Changer</button>
                </div>
              </div>
            ) : (
              <>
                <Drop accept="image/*" icon={<ImageSquare size={28} weight="bold" />} title="Dépose une photo" sub="Un visage net, de face, bien éclairé." compact
                  onPick={(f) => setImage({ url: URL.createObjectURL(f), name: f.name })} />
                <button type="button" onClick={() => { setImage({ url: "/wall/tenues.jpg", name: "Personnage IA (exemple)" }); setWho("ia"); }}
                  className="glass flex items-center gap-3 rounded-[14px] p-2 text-left hover:bg-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/wall/tenues.jpg" alt="" className="h-14 w-10 rounded-[10px] object-cover" />
                  <span className="text-[14px]">Essayer avec un personnage IA (exemple)</span>
                </button>
              </>
            )}
          </section>

          {/* 3. Rights */}
          <section className="glass flex flex-col gap-3 rounded-[24px] p-4" aria-labelledby="droits">
            <h2 id="droits" className="flex items-center gap-2 text-[15px] font-semibold"><Step n={3} done={ownVideo && (who === "ia" || consent)} /> Les droits</h2>
            <fieldset className="flex gap-2">
              <legend className="sr-only">Le nouveau personnage est</legend>
              {(["ia", "reelle"] as Who[]).map((w) => (
                <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)}
                  className={`h-9 rounded-full px-3.5 text-[14px] font-semibold ${who === w ? "bg-violet text-on-violet" : "glass text-ink-muted"}`}>
                  {w === "ia" ? "Personnage inventé" : "Personne réelle"}
                </button>
              ))}
            </fieldset>
            <Check2 checked={ownVideo} onChange={setOwnVideo}>La vidéo est à moi, ou j&apos;ai le droit de la modifier.</Check2>
            {who === "reelle" && (
              <Check2 checked={consent} onChange={setConsent}>J&apos;ai le consentement écrit de la personne sur la photo pour l&apos;utiliser dans cette vidéo.</Check2>
            )}
            <p className="text-[13px] leading-snug text-ink-muted">Pas de faux témoignages, pas de vraies personnes sans leur accord, pas de contenu trompeur. Agent double sert à créer, pas à tromper.</p>
          </section>
        </div>
      </div>

      {/* 4. Pipeline */}
      <section className="glass light-edge flex flex-col gap-4 rounded-[24px] p-5" aria-labelledby="pipeline">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pipeline" className="font-display text-[22px] font-extrabold uppercase">Le pipeline</h2>
          <span className="glass rounded-full px-3 py-1 font-mono text-[12px] text-ink-muted">{engine ? "Moteur GPU en ligne" : "Moteur GPU en préparation"}</span>
        </div>
        <ol className="grid gap-2 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.k} className="flex flex-col gap-1 rounded-[14px] border border-glass-rim p-3">
              <span className="font-mono text-[12px] text-lilas tabular">0{i + 1}</span>
              <span className="text-[15px] font-semibold">{s.label}</span>
              <span className="text-[13px] leading-snug text-ink-muted">{s.detail}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-end gap-3">
          {engine && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-ink-muted">Code d&apos;accès Pro</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false}
                className="glass h-11 w-48 rounded-full px-4 font-mono text-[14px] outline-none focus:ring-2 focus:ring-[var(--focus)]" />
            </label>
          )}
          <Button onClick={() => generate(true)} disabled={!engine || !ready || !code.trim() || busyJob} className="disabled:cursor-not-allowed disabled:opacity-60">
            {busyJob ? "Génération…" : engine ? "Générer un brouillon (480p)" : "Générer un brouillon (bientôt)"}
          </Button>
          <p className="text-[14px] text-ink-muted">
            {tooLong ? "Pour l'instant, la scène doit faire 10 secondes ou moins."
              : !ready ? `Il manque : ${missing.join(", ")}.`
              : !engine ? "Tout est prêt. Le brouillon sera généré dès que le moteur est en ligne, puis la version finale après ton OK."
              : "Une personne à l'écran pour l'instant. Le brouillon prend quelques minutes."}
          </p>
        </div>
        {job && (
          <div role="status" className="flex flex-col gap-3 rounded-[18px] border border-glass-rim p-4">
            <p className="text-[15px]">{job.error ? <span className="text-rec">{job.error}</span> : STATE_TEXT[job.status.state]}{job.status.state === "queued" && job.status.position ? ` (position ${job.status.position})` : ""}</p>
            {job.result && (
              <>
                <video src={job.result} controls playsInline className="max-h-[60vh] w-full rounded-[14px] bg-black object-contain" />
                <a href={job.result} download={`agent-double-${job.id}.mp4`} className="inline-flex h-11 w-fit items-center rounded-full bg-ok px-5 text-[15px] font-semibold text-on-ok">{job.draft ? "Télécharger le brouillon" : "Télécharger la version finale"}</a>
                {job.draft && !job.status.dry_run && (
                  <Button onClick={() => generate(false)} disabled={!ready} className="w-fit disabled:opacity-60">C&apos;est bon : version finale (720p)</Button>
                )}
                {job.status.dry_run && <p className="text-[13px] text-ink-muted">Test du serveur : le résultat est ta scène d&apos;origine, sans remplacement.</p>}
              </>
            )}
          </div>
        )}
      </section>

      <HistoryPanel tool="agent-double" />
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`flex size-6 items-center justify-center rounded-full text-[12px] font-bold ${done ? "bg-ok text-on-ok" : "border border-glass-rim text-ink-muted"}`}>
      {done ? <Check size={14} weight="bold" aria-hidden /> : n}
    </span>
  );
}

function Check2({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--violet)]" />
      <span>{children}</span>
    </label>
  );
}

function Drop({ accept, icon, title, sub, onPick, compact = false }: { accept: string; icon: React.ReactNode; title: string; sub: string; onPick: (f: File) => void; compact?: boolean }) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onPick(f); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-glass-rim text-center hover:bg-white/5 ${compact ? "p-5" : "min-h-[36vh] p-8"}`}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-corail text-on-corail" aria-hidden>{icon ?? <UploadSimple size={24} />}</span>
      <span className="text-[17px] font-semibold">{title}</span>
      <span className="text-[14px] text-ink-muted">{sub}</span>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
    </label>
  );
}
