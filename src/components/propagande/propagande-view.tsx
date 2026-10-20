"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowArcLeft, ArrowLeft, ArrowRight, ArrowsOutLineHorizontal, Check, DownloadSimple, Minus, Play, Plus,
  SlidersHorizontal, Trash, UploadSimple, VideoCamera,
} from "@phosphor-icons/react";
import { HistoryPanel } from "@/components/library/history-panel";
import { ToolHeader } from "@/components/site/tool-header";
import { Button } from "@/components/ui/button";
import { analyzeFile, fmtTime, shiftMoment, type Moment } from "@/lib/clips/analyze";
import { exportClip } from "@/lib/clips/export";
import { takeHandoff, type Handoff } from "@/lib/handoff";
import { addCreation } from "@/lib/library";

type Clip = Moment & { focus: number; progress?: number; out?: { url: string; ext: string }; error?: string };
type Phase = "idle" | "analyse" | "pret" | "erreur";

/** Propagande, one drop: a long video in, a feed of finished vertical clips out. Runs on the device. */
export function PropagandeView() {
  const [handoff] = useState<Handoff | null>(() => (typeof window === "undefined" ? null : takeHandoff("propagande")));
  const [file, setFile] = useState<File | null>(handoff?.file ?? null);
  const [url, setUrl] = useState(() => (handoff ? URL.createObjectURL(handoff.file) : ""));
  const [phase, setPhase] = useState<Phase>(handoff ? "analyse" : "idle");
  const [clips, setClips] = useState<Clip[]>([]);
  const [removed, setRemoved] = useState<Clip | null>(null);
  const [env, setEnv] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [count, setCount] = useState(handoff?.count ?? 8);
  const [length, setLength] = useState(handoff?.length ?? 30);
  const [open, setOpen] = useState<"" | "reglages" | "source">("");
  const [batch, setBatch] = useState<{ i: number; n: number } | null>(null);
  const runId = useRef(0);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function analyse(f: File, n: number, len: number) {
    const id = ++runId.current;
    analyzeFile(f, { count: n, length: len })
      .then((a) => {
        if (id !== runId.current) return;
        setEnv(a.env);
        setDuration(a.duration);
        setClips(a.moments.map((m) => ({ ...m, focus: 0.5 })));
        setPhase("pret");
      })
      .catch(() => id === runId.current && setPhase("erreur"));
  }

  // A file handed over from the home composer starts right away
  useEffect(() => {
    if (handoff) analyse(handoff.file, handoff.count ?? 8, handoff.length ?? 30);
    return () => { runId.current++; };
  }, [handoff]);

  function pick(f?: File) {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setClips([]);
    setPhase("analyse");
    analyse(f, count, length);
  }

  function rerun() {
    if (!file) return;
    setClips([]);
    setPhase("analyse");
    analyse(file, count, length);
  }

  const update = (id: string, patch: Partial<Clip>) => setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function shift(c: Clip, dir: -1 | 1) {
    if (!env) return;
    const m = shiftMoment(env, c, dir, duration);
    update(c.id, { start: m.start, end: m.end, out: undefined, error: undefined });
  }

  function remove(c: Clip) {
    setClips((cs) => cs.filter((x) => x.id !== c.id));
    setRemoved(c);
  }
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);
  function undo() {
    if (!removed) return;
    setClips((cs) => [...cs, removed].sort((a, b) => a.start - b.start));
    setRemoved(null);
  }

  async function render(c: Clip, n: number): Promise<{ url: string; ext: string } | null> {
    update(c.id, { progress: 0, out: undefined, error: undefined });
    try {
      const r = await exportClip(url, c, c.focus, (p) => update(c.id, { progress: p }));
      const out = { url: URL.createObjectURL(r.blob), ext: r.ext };
      update(c.id, { progress: undefined, out });
      await addCreation({ tool: "propagande", title: `Moment ${n} · ${file?.name.replace(/\.[^.]+$/, "") ?? "vidéo"}`, source: file?.name ?? "", start: c.start, end: c.end, ext: r.ext, score: c.score }, r.blob).catch(() => {});
      return out;
    } catch (e) {
      update(c.id, { progress: undefined, error: e instanceof Error ? e.message : "L'export a échoué." });
      return null;
    }
  }

  function save(out: { url: string; ext: string }, n: number) {
    const a = document.createElement("a");
    a.href = out.url;
    a.download = `propagande-${n}.${out.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadAll() {
    const list = [...clips];
    setBatch({ i: 0, n: list.length });
    for (let k = 0; k < list.length; k++) {
      setBatch({ i: k + 1, n: list.length });
      const c = list[k];
      const out = c.out ?? (await render(c, k + 1));
      if (out) save(out, k + 1);
    }
    setBatch(null);
  }

  const busy = batch !== null || clips.some((c) => c.progress !== undefined);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pb-32 md:p-6">
      <ToolHeader tool="propagande" line="Une vidéo longue devient des clips verticaux qui tournent partout." note="Tout reste sur ton appareil. Rien n'est envoyé." />

      {phase === "idle" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <DropZone onPick={pick} />
          <HistoryPanel tool="propagande" className="max-h-[70vh]" />
        </div>
      )}

      {phase !== "idle" && file && (
        <>
          {/* Toolbar: the file, two folded panels, the one big action */}
          <div className="glass flex flex-wrap items-center gap-2 rounded-[20px] p-2">
            <span className="flex min-w-0 items-center gap-2 pl-2 text-[14px] font-semibold"><VideoCamera size={18} aria-hidden /><span className="truncate">{file.name}</span></span>
            <label className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold text-lilas hover:underline">
              Changer<input type="file" accept="video/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Toggle on={open === "reglages"} onClick={() => setOpen(open === "reglages" ? "" : "reglages")} icon={<SlidersHorizontal size={16} aria-hidden />}>Réglages</Toggle>
              <Toggle on={open === "source"} onClick={() => setOpen(open === "source" ? "" : "source")} icon={<Play size={16} aria-hidden />}>Vidéo source</Toggle>
              <Button onClick={downloadAll} disabled={phase !== "pret" || !clips.length || busy} className="h-10 disabled:opacity-50">
                <DownloadSimple size={18} weight="bold" aria-hidden />
                {batch ? `Clip ${batch.i} sur ${batch.n}…` : `Tout télécharger${clips.length ? ` (${clips.length})` : ""}`}
              </Button>
            </div>
          </div>

          {open === "reglages" && (
            <div className="glass flex flex-wrap items-end gap-4 rounded-[20px] p-4">
              <Stepper label="Clips" value={count} min={3} max={20} onChange={setCount} />
              <Stepper label="Durée (s)" value={length} min={15} max={60} step={5} onChange={setLength} />
              <Button variant="secondary" onClick={rerun} disabled={phase === "analyse" || busy}>Relancer</Button>
              <p className="max-w-[46ch] text-[13px] leading-snug text-ink-muted">On repère les moments forts à partir du son (énergie, réactions, voix qui ne s&apos;arrête pas). La transcription et les sous-titres arrivent ensuite.</p>
            </div>
          )}
          {open === "source" && <Source url={url} env={env} duration={duration} clips={clips} />}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-label="Clips" aria-busy={phase === "analyse"} className="min-w-0">
              {phase === "analyse" && (
                <>
                  <p className="mb-3 text-[15px] text-ink-muted">On écoute ta vidéo et on choisit les moments forts… (une heure prend environ une minute)</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
                    {Array.from({ length: count }, (_, i) => <div key={i} className="aspect-[9/16] animate-pulse rounded-[22px] bg-line/60" />)}
                  </div>
                </>
              )}
              {phase === "erreur" && <p className="rounded-[18px] border border-rec p-4 text-[15px]">On n&apos;a pas pu lire le son de cette vidéo. Essaie un MP4 ou un MOV.</p>}
              {phase === "pret" && !clips.length && <p className="glass rounded-[18px] p-4 text-[15px] text-ink-muted">Aucun moment gardé. Relance avec d&apos;autres réglages, ou change de vidéo.</p>}
              {phase === "pret" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
                  {clips.map((c, i) => (
                    <ClipCard key={c.id} n={i + 1} c={c} src={url} disabled={busy}
                      onFocus={(f) => update(c.id, { focus: f, out: undefined })}
                      onEarlier={() => shift(c, -1)} onLater={() => shift(c, 1)} onRemove={() => remove(c)}
                      onExport={() => render(c, i + 1)} onSave={() => c.out && save(c.out, i + 1)} />
                  ))}
                </div>
              )}
            </section>
            <HistoryPanel tool="propagande" className="h-fit xl:max-h-[calc(100dvh-220px)]" />
          </div>
        </>
      )}

      {removed && (
        <div role="status" className="glass fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pr-2 pl-4 shadow-lift" style={{ bottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}>
          <span className="text-[14px]">Clip retiré.</span>
          <button type="button" onClick={undo} className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-[13px] font-semibold text-surface-100"><ArrowArcLeft size={16} aria-hidden /> Annuler</button>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" aria-expanded={on} onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${on ? "bg-violet text-on-violet" : "text-ink-muted hover:bg-white/10 hover:text-ink"}`}>
      {icon}{children}
    </button>
  );
}

function DropZone({ onPick }: { onPick: (f?: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files?.[0]); }}
      className={`light-edge glass flex min-h-[52vh] cursor-pointer flex-col items-center justify-center gap-4 rounded-[36px] p-8 text-center transition-colors ${over ? "bg-white/10" : ""}`}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-corail text-on-corail"><UploadSimple size={30} weight="bold" aria-hidden /></span>
      <span className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.02em] md:text-[40px]">Dépose une vidéo longue</span>
      <span className="max-w-[46ch] text-[16px] text-ink-muted">Un live, un podcast, un vlog. Tu reçois les meilleurs moments, déjà en 9:16, prêts à publier.</span>
      <span className="font-mono text-[13px] text-ink-muted">MP4 · MOV · jusqu&apos;à 1 h</span>
      <input type="file" accept="video/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
  );
}

function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold text-ink-muted">{label}</span>
      <div className="glass flex h-11 items-center gap-1 rounded-full px-1">
        <button type="button" aria-label={`${label} : moins`} onClick={() => onChange(Math.max(min, value - step))} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"><Minus size={16} aria-hidden /></button>
        <span className="w-8 text-center font-mono tabular">{value}</span>
        <button type="button" aria-label={`${label} : plus`} onClick={() => onChange(Math.min(max, value + step))} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"><Plus size={16} aria-hidden /></button>
      </div>
    </div>
  );
}

/** The original video and its loudness, with the kept moments marked. Folded away by default. */
function Source({ url, env, duration, clips }: { url: string; env: Float32Array | null; duration: number; clips: Clip[] }) {
  const v = useRef<HTMLVideoElement>(null);
  const bars = useMemo(() => {
    if (!env) return [];
    const n = 160, out: number[] = [];
    const per = Math.max(1, Math.floor(env.length / n));
    let max = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = i * per; k < Math.min(env.length, (i + 1) * per); k++) s = Math.max(s, env[k]);
      out.push(s); max = Math.max(max, s);
    }
    return out.map((x) => (max ? x / max : 0));
  }, [env]);
  return (
    <section className="glass grid gap-4 rounded-[20px] p-4 lg:grid-cols-[minmax(0,420px)_1fr]" aria-label="Vidéo source">
      <video ref={v} src={url} controls playsInline className="aspect-video w-full rounded-[14px] bg-black" />
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <div className="relative h-20 w-full overflow-hidden rounded-[12px] bg-surface-200">
          {clips.map((c) => (
            <button key={c.id} type="button" aria-label={`Lire depuis ${fmtTime(c.start)}`} onClick={() => { if (v.current) { v.current.currentTime = c.start; v.current.play(); } }}
              className="absolute inset-y-0 bg-corail/30 ring-1 ring-corail hover:bg-corail/45" style={{ left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%` }} />
          ))}
          <div className="pointer-events-none absolute inset-0 flex items-end gap-px px-1">
            {bars.map((x, i) => <span key={i} className="flex-1 rounded-t-sm bg-violet/60" style={{ height: `${Math.max(4, x * 100)}%` }} />)}
          </div>
        </div>
        <div className="flex justify-between font-mono text-[12px] text-ink-muted tabular"><span>0:00</span><span>{fmtTime(duration)}</span></div>
      </div>
    </section>
  );
}

function ClipCard({ n, c, src, disabled, onFocus, onEarlier, onLater, onRemove, onExport, onSave }: {
  n: number; c: Clip; src: string; disabled: boolean;
  onFocus: (f: number) => void; onEarlier: () => void; onLater: () => void; onRemove: () => void; onExport: () => void; onSave: () => void;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reframe, setReframe] = useState(false);
  const drag = useRef<{ x: number; f: number; w: number } | null>(null);
  useEffect(() => { if (v.current) v.current.currentTime = c.start + 0.05; }, [c.start]);

  const toggle = () => {
    const el = v.current;
    if (!el || reframe) return;
    if (playing) { el.pause(); setPlaying(false); return; }
    if (el.currentTime < c.start || el.currentTime >= c.end) el.currentTime = c.start;
    el.play(); setPlaying(true);
  };
  const exporting = c.progress !== undefined;

  return (
    <article className="glass flex flex-col gap-2.5 rounded-[24px] p-2.5">
      <div
        className={`relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-black ${reframe ? "cursor-ew-resize ring-2 ring-corail" : "cursor-pointer"}`}
        onClick={toggle}
        onPointerDown={(e) => { if (!reframe) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, f: c.focus, w: e.currentTarget.clientWidth }; }}
        onPointerMove={(e) => { const d = drag.current; if (!reframe || !d) return; onFocus(Math.min(1, Math.max(0, d.f - (e.clientX - d.x) / (d.w * 1.6)))); }}
        onPointerUp={() => { drag.current = null; }}
        onKeyDown={(e) => { if (!reframe) return; if (e.key === "ArrowLeft") onFocus(Math.max(0, c.focus - 0.05)); if (e.key === "ArrowRight") onFocus(Math.min(1, c.focus + 0.05)); }}
        tabIndex={reframe ? 0 : -1}
        role={reframe ? "slider" : undefined}
        aria-label={reframe ? "Cadrage : glisse ou utilise les flèches" : undefined}
        aria-valuenow={reframe ? Math.round(c.focus * 100) : undefined}
      >
        <video ref={v} src={src} playsInline preload="metadata" className="h-full w-full object-cover" style={{ objectPosition: `${c.focus * 100}% 50%` }}
          onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= c.end) { e.currentTarget.pause(); setPlaying(false); } }} />
        <span className="glass absolute top-2 left-2 rounded-full px-2.5 py-1 font-mono text-[12px] tabular">#{n} · {fmtTime(c.end - c.start)}</span>
        {!playing && !reframe && <span className="absolute inset-0 flex items-center justify-center"><span className="glass flex size-12 items-center justify-center rounded-full"><Play size={22} weight="fill" aria-hidden /></span></span>}
        {reframe && (
          <span className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-black/60 py-2 text-[13px] font-semibold text-white">
            <ArrowsOutLineHorizontal size={16} aria-hidden /> Glisse pour recadrer
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-0.5">
        {c.reasons.map((r) => <span key={r} className="rounded-full border border-glass-rim px-2.5 py-0.5 text-[12px] font-semibold text-ink-muted">{r}</span>)}
      </div>

      <div className="grid grid-cols-4 gap-1">
        <Verb label="Plus tôt" onClick={onEarlier} disabled={disabled || reframe}><ArrowLeft size={18} aria-hidden /></Verb>
        <Verb label="Plus tard" onClick={onLater} disabled={disabled || reframe}><ArrowRight size={18} aria-hidden /></Verb>
        <Verb label={reframe ? "OK" : "Recadrer"} onClick={() => { setReframe((r) => !r); if (v.current && playing) { v.current.pause(); setPlaying(false); } }} disabled={disabled} on={reframe}>
          {reframe ? <Check size={18} weight="bold" aria-hidden /> : <ArrowsOutLineHorizontal size={18} aria-hidden />}
        </Verb>
        <Verb label="Retirer" onClick={onRemove} disabled={disabled || reframe}><Trash size={18} aria-hidden /></Verb>
      </div>

      {c.out ? (
        <button type="button" onClick={onSave} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ok px-5 text-[15px] font-semibold text-on-ok">
          <DownloadSimple size={18} weight="bold" aria-hidden /> Télécharger
        </button>
      ) : (
        <Button variant="secondary" onClick={onExport} disabled={disabled || exporting || reframe} className="w-full disabled:opacity-60">
          {exporting ? `Rendu… ${Math.round((c.progress ?? 0) * 100)} %` : "Exporter ce clip"}
        </Button>
      )}
      {c.error && <p className="text-[13px] text-rec">{c.error}</p>}
    </article>
  );
}

function Verb({ label, onClick, disabled, on, children }: { label: string; onClick: () => void; disabled?: boolean; on?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded-[12px] py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-40 ${on ? "bg-corail text-on-corail" : "text-ink-muted hover:bg-white/10 hover:text-ink"}`}>
      {children}
      {label}
    </button>
  );
}
