"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, FilmSlate, Minus, Plus, Scissors, UploadSimple } from "@phosphor-icons/react";
import { ToolHeader } from "@/components/site/tool-header";
import { Button } from "@/components/ui/button";
import { analyzeFile, fmtTime, type Moment } from "@/lib/clips/analyze";
import { exportClip } from "@/lib/clips/export";

type Clip = Moment & { focus: number; progress?: number; out?: { url: string; ext: string } ; error?: string };
type Status = { kind: "idle" } | { kind: "analyse" } | { kind: "pret" } | { kind: "erreur"; msg: string };

/** Propagande: drop a long video, get its strongest moments as 9:16 clips, export them. Runs on the device. */
export function PropagandeView() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [clips, setClips] = useState<Clip[]>([]);
  const [env, setEnv] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [count, setCount] = useState(8);
  const [length, setLength] = useState(30);
  const main = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function run(f: File, n = count, len = length) {
    setStatus({ kind: "analyse" });
    setClips([]);
    try {
      const a = await analyzeFile(f, { count: n, length: len });
      setEnv(a.env);
      setDuration(a.duration);
      setClips(a.moments.map((m) => ({ ...m, focus: 0.5 })));
      setStatus({ kind: "pret" });
    } catch {
      setStatus({ kind: "erreur", msg: "On n'a pas pu lire le son de cette vidéo. Essaie un MP4 ou un MOV." });
    }
  }

  function onPick(f?: File) {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    run(f);
  }

  const update = (id: string, patch: Partial<Clip>) => setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  async function doExport(c: Clip) {
    update(c.id, { progress: 0, out: undefined, error: undefined });
    try {
      const r = await exportClip(url, c, c.focus, (p) => update(c.id, { progress: p }));
      update(c.id, { progress: undefined, out: { url: URL.createObjectURL(r.blob), ext: r.ext } });
    } catch (e) {
      update(c.id, { progress: undefined, error: e instanceof Error ? e.message : "L'export a échoué." });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pb-32 md:p-6">
      <ToolHeader tool="propagande" line="Une vidéo longue devient des clips verticaux qui tournent partout." note="Tout reste sur ton appareil. Rien n'est envoyé." />

      {!file && <DropZone onPick={onPick} />}

      {file && (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* Source + timeline */}
          <section className="glass flex min-w-0 flex-col gap-4 rounded-[24px] p-4" aria-label="Vidéo source">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[15px] font-semibold">{file.name}</p>
              <button type="button" onClick={() => { setFile(null); setClips([]); setStatus({ kind: "idle" }); }} className="shrink-0 text-[14px] font-semibold text-lilas hover:underline">
                Changer de vidéo
              </button>
            </div>
            <video ref={main} src={url} controls playsInline className="aspect-video w-full rounded-[18px] bg-black" />
            {env && <Timeline env={env} duration={duration} clips={clips} onSeek={(t) => { if (main.current) { main.current.currentTime = t; main.current.play(); } }} />}
            <div className="flex flex-wrap items-end gap-4">
              <Stepper label="Clips" value={count} min={3} max={20} onChange={setCount} />
              <Stepper label="Durée (s)" value={length} min={15} max={60} step={5} onChange={setLength} />
              <Button variant="secondary" onClick={() => file && run(file, count, length)} disabled={status.kind === "analyse"}>
                <Scissors size={18} aria-hidden /> Relancer
              </Button>
            </div>
            <p className="text-[13px] leading-snug text-ink-muted">
              Version 1 : on repère les moments forts à partir du son (rires, voix qui monte, réactions). La transcription et le choix par IA arrivent ensuite.
            </p>
          </section>

          {/* Moments */}
          <section className="flex min-w-0 flex-col gap-3" aria-label="Moments">
            <h2 className="font-display text-[24px] font-extrabold uppercase">Moments forts</h2>
            {status.kind === "analyse" && <p className="glass rounded-[18px] p-4 text-[15px] text-ink-muted">On écoute ta vidéo… (une heure prend environ une minute)</p>}
            {status.kind === "erreur" && <p className="rounded-[18px] border border-rec p-4 text-[15px]">{status.msg}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clips.map((c, i) => (
                <ClipCard key={c.id} n={i + 1} c={c} src={url} update={update} onExport={() => doExport(c)} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DropZone({ onPick }: { onPick: (f?: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files?.[0]); }}
      className={`light-edge glass flex min-h-[46vh] cursor-pointer flex-col items-center justify-center gap-4 rounded-[36px] p-8 text-center transition-colors ${over ? "bg-white/10" : ""}`}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-corail text-on-corail"><UploadSimple size={30} weight="bold" aria-hidden /></span>
      <span className="font-display text-[30px] leading-tight font-extrabold uppercase md:text-[40px]">Dépose une vidéo longue</span>
      <span className="max-w-[46ch] text-[16px] text-ink-muted">Un live, un podcast, un vlog, une conférence. On trouve les moments forts et on les recadre en 9:16, prêts à publier.</span>
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

/** Loudness over time; detected moments are coral bands you can click to play. */
function Timeline({ env, duration, clips, onSeek }: { env: Float32Array; duration: number; clips: Clip[]; onSeek: (t: number) => void }) {
  const bars = useMemo(() => {
    const n = 160, out: number[] = [];
    const per = Math.max(1, Math.floor(env.length / n));
    let max = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = i * per; k < Math.min(env.length, (i + 1) * per); k++) s = Math.max(s, env[k]);
      out.push(s); max = Math.max(max, s);
    }
    return out.map((v) => (max ? v / max : 0));
  }, [env]);
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-16 w-full overflow-hidden rounded-[12px] bg-surface-100">
        {clips.map((c) => (
          <button key={c.id} type="button" aria-label={`Lire le moment de ${fmtTime(c.start)}`} onClick={() => onSeek(c.start)}
            className="absolute inset-y-0 bg-corail/30 ring-1 ring-corail hover:bg-corail/45"
            style={{ left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%` }} />
        ))}
        <div className="pointer-events-none absolute inset-0 flex items-end gap-px px-1">
          {bars.map((v, i) => <span key={i} className="flex-1 rounded-t-sm bg-lilas/70" style={{ height: `${Math.max(4, v * 100)}%` }} />)}
        </div>
      </div>
      <div className="flex justify-between font-mono text-[12px] text-ink-muted tabular"><span>0:00</span><span>{fmtTime(duration)}</span></div>
    </div>
  );
}

function ClipCard({ n, c, src, update, onExport }: { n: number; c: Clip; src: string; update: (id: string, p: Partial<Clip>) => void; onExport: () => void }) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (v.current) v.current.currentTime = c.start + 0.05; }, [c.start]);
  const toggle = () => {
    const el = v.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); return; }
    if (el.currentTime < c.start || el.currentTime >= c.end) el.currentTime = c.start;
    el.play(); setPlaying(true);
  };
  const busy = c.progress !== undefined;
  return (
    <article className="glass flex flex-col gap-3 rounded-[24px] p-3">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Lire le moment"} className="relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-black">
        <video ref={v} src={src} muted={false} playsInline preload="metadata" className="h-full w-full object-cover"
          style={{ objectPosition: `${c.focus * 100}% 50%` }}
          onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= c.end) { e.currentTarget.pause(); setPlaying(false); } }} />
        <span className="glass absolute top-2 left-2 rounded-full px-2.5 py-1 font-mono text-[12px] tabular">#{n} · {fmtTime(c.start)}</span>
        <span className="absolute top-2 right-2 rounded-full bg-corail px-2.5 py-1 font-mono text-[12px] font-semibold text-on-corail tabular">{Math.round(c.score * 100)}</span>
        {!playing && <span className="absolute inset-0 flex items-center justify-center"><FilmSlate size={36} className="text-white/80" aria-hidden /></span>}
      </button>

      <div className="flex items-center justify-between gap-2 font-mono text-[13px] tabular">
        <Nudge label="Début" onMinus={() => update(c.id, { start: Math.max(0, c.start - 1) })} onPlus={() => update(c.id, { start: Math.min(c.end - 5, c.start + 1) })} value={fmtTime(c.start)} />
        <Nudge label="Fin" onMinus={() => update(c.id, { end: Math.max(c.start + 5, c.end - 1) })} onPlus={() => update(c.id, { end: c.end + 1 })} value={fmtTime(c.end)} />
      </div>

      <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-muted">
        Cadrage
        <input type="range" min={0} max={1} step={0.01} value={c.focus} onChange={(e) => update(c.id, { focus: Number(e.target.value) })} className="accent-[var(--violet)]" />
        <span className="flex justify-between font-normal"><span>Gauche</span><span>Droite</span></span>
      </label>

      {c.out ? (
        <a href={c.out.url} download={`propagande-${n}.${c.out.ext}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ok px-5 text-[15px] font-semibold text-on-corail">
          <DownloadSimple size={18} weight="bold" aria-hidden /> Télécharger ({c.out.ext.toUpperCase()})
        </a>
      ) : (
        <Button onClick={onExport} disabled={busy} className="w-full">
          {busy ? `Export… ${Math.round((c.progress ?? 0) * 100)} %` : "Exporter en 9:16"}
        </Button>
      )}
      {c.error && <p className="text-[13px] text-rec">{c.error}</p>}
    </article>
  );
}

function Nudge({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`${label} : moins 1 seconde`} onClick={onMinus} className="glass flex size-8 items-center justify-center rounded-full"><Minus size={14} aria-hidden /></button>
      <span className="w-12 text-center">{value}</span>
      <button type="button" aria-label={`${label} : plus 1 seconde`} onClick={onPlus} className="glass flex size-8 items-center justify-center rounded-full"><Plus size={14} aria-hidden /></button>
    </div>
  );
}
