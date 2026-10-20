"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowArcLeft, ArrowLeft, ArrowRight, ArrowsOutLineHorizontal, Check, ClosedCaptioning, DownloadSimple, Minus, Play, Plus,
  SlidersHorizontal, Trash, UploadSimple, VideoCamera,
} from "@phosphor-icons/react";
import { HistoryPanel } from "@/components/library/history-panel";
import { ToolHeader } from "@/components/site/tool-header";
import { Button } from "@/components/ui/button";
import { envelopeOf, fmtTime, HOP, pickMoments, shiftMoment } from "@/lib/clips/analyze";
import { exportClip } from "@/lib/clips/export";
import {
  capText, captionAt, captionChunks, pickFromTranscript, segsLength, sentences, shiftBySentence, zscore,
  type Chunk, type Hook, type HookId, type Sentence, type TMoment,
} from "@/lib/clips/moments";
import { cacheKey, cachedWords, cacheWords, decodeMono, modelStatus, pickRuntime, SR, speechWindows, transcribe, type Progress } from "@/lib/clips/transcribe";
import { keepModel } from "@/lib/clips/model-store";
import { ping, pingClipMade } from "@/lib/ping";
import { takeHandoff, type Handoff } from "@/lib/handoff";
import { addCreation } from "@/lib/library";

type Clip = {
  id: string; start: number; end: number; score: number; reasons: string[];
  i?: number; j?: number; hooks: Hook[]; hook: number; focus: number;
  progress?: number; out?: { url: string; ext: string }; error?: string;
};
type Phase = "idle" | "analyse" | "accord" | "pret" | "erreur";
type Voice = "ask" | "yes" | "no";
type Ask = { f: File; n: number; len: number; sizeMb: number; cellular: boolean; cpu: boolean };
type Source = { env: Float32Array; z: Float32Array; duration: number; sents: Sentence[] | null; chunks: Chunk[] | null; engine: string };

const LANG: Record<string, string> = { fr: "français", en: "anglais", es: "espagnol", ar: "arabe", pt: "portugais", de: "allemand", it: "italien" };
const SHORT: Record<HookId, string> = { tel: "Tel quel", punch: "Punch", question: "Question" };
const range = (len: number) => ({ lo: Math.max(8, len - 10), hi: len + 15 });

function toClip(m: TMoment, keep?: { focus: number; hookId?: HookId }): Clip {
  const want = keep?.hookId ?? "punch";
  const k = m.hooks.findIndex((h) => h.id === want);
  return { ...m, focus: keep?.focus ?? 0.5, hook: k >= 0 ? k : 0 };
}

function stageText(p: Progress | null, startedAt: number): { text: string; p: number | null } {
  if (!p || p.stage === "lang") return { text: "On écoute ta vidéo…", p: null };
  if (p.stage === "model") {
    const mb = (n: number) => Math.round(n / 1e6);
    return { text: `Préparation du modèle de voix, une seule fois : ${mb(p.loaded)} Mo sur ${mb(p.total) || "…"}`, p: p.total ? p.loaded / p.total : null };
  }
  const left = p.done && startedAt ? ((Date.now() - startedAt) / p.done) * (p.total - p.done) : 0;
  const eta = !p.done ? "" : left < 60000 ? " · moins d'une minute" : ` · environ ${Math.ceil(left / 60000)} min`;
  return { text: `On transcrit ta vidéo, sur ton appareil : ${p.done} passages sur ${p.total}${eta}`, p: p.total ? p.done / p.total : null };
}

/** Propagande, one drop: a long video in, a feed of finished vertical clips out. Runs on the device. */
export function PropagandeView() {
  const [handoff] = useState<Handoff | null>(() => (typeof window === "undefined" ? null : takeHandoff("propagande")));
  const [file, setFile] = useState<File | null>(handoff?.file ?? null);
  const [url, setUrl] = useState(() => (handoff ? URL.createObjectURL(handoff.file) : ""));
  const [phase, setPhase] = useState<Phase>(handoff ? "analyse" : "idle");
  const [stage, setStage] = useState<Progress | null>(null);
  const [speechStart, setSpeechStart] = useState(0);
  const [notice, setNotice] = useState("");
  const [src, setSrc] = useState<Source | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [removed, setRemoved] = useState<Clip | null>(null);
  const [count, setCount] = useState(handoff?.count ?? 8);
  const [length, setLength] = useState(handoff?.length ?? 30);
  const [captions, setCaptions] = useState(true);
  const [endCard, setEndCard] = useState(true);
  const [open, setOpen] = useState<"" | "reglages" | "source">("");
  const [batch, setBatch] = useState<{ i: number; n: number } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const run = useRef<AbortController | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => run.current?.abort(), []);
  useEffect(() => ping("open"), []);

  function choose(s: Source, n: number, len: number): Clip[] {
    const { lo, hi } = range(len);
    const ms = s.sents ? pickFromTranscript(s.sents, s.z, HOP, s.duration, n, lo, hi) : [];
    if (ms.length) return ms.map((m) => toClip(m));
    return pickMoments(s.env, s.duration, n, len).map((m) => ({
      ...m, focus: 0.5, hook: 0, hooks: [{ id: "tel" as const, label: "Tel quel", segs: [{ start: m.start, end: m.end }], line: "" }],
    }));
  }

  async function analyse(f: File, n: number, len: number, voice: Voice = "ask") {
    run.current?.abort();
    const ctrl = new AbortController();
    run.current = ctrl;
    try {
      const audio = await decodeMono(f);
      if (ctrl.signal.aborted) return;
      const env = envelopeOf(audio, SR);
      const duration = audio.length / SR;
      const z = zscore(env);
      const rt = await pickRuntime();
      const key = cacheKey(f, rt.model);
      let words = await cachedWords(key);
      let note = "";
      let detected = "";
      if (!words && voice === "ask") {
        // First run on this browser: say what will be downloaded, and how this device will do, before anything starts
        const m = await modelStatus(rt);
        if (ctrl.signal.aborted) return;
        if (!m.cached) {
          ping(rt.device === "webgpu" ? "device-gpu" : "device-cpu");
          setAsk({ f, n, len, sizeMb: m.sizeMb, cellular: m.cellular, cpu: rt.device === "wasm" });
          setPhase("accord");
          return;
        }
      }
      if (!words && voice === "no") {
        words = [];
        note = "Sans sous-titres : les moments sont choisis au son. Tu peux activer la voix plus tard en changeant de vidéo.";
      }
      if (!words) {
        const wins = speechWindows(env, HOP, duration);
        let started = 0;
        try {
          let lang = "";
          words = wins.length
            ? await transcribe(audio, wins, rt, (p) => {
                if (ctrl.signal.aborted) return;
                if (p.stage === "lang") { lang = p.code; return; }
                if (p.stage === "speech" && !started) { started = Date.now(); setSpeechStart(started); }
                setStage(p);
              }, ctrl.signal)
            : [];
          if (words.length) { void cacheWords(key, words); void keepModel(); }
          if (lang) detected = lang;
        } catch (e) {
          if (ctrl.signal.aborted) return;
          console.warn("[propagande] transcription", e);
          ping("voice-fail");
          words = [];
          note = "La transcription n'a pas marché dans ce navigateur. Les moments sont choisis au son, sans sous-titres.";
        }
      }
      if (ctrl.signal.aborted) return;
      const hasSpeech = words.length >= 8;
      if (!hasSpeech && !note) note = "On n'entend presque pas de voix. Les moments sont choisis au son, sans sous-titres.";
      const s: Source = {
        env, z, duration,
        sents: hasSpeech ? sentences(words) : null,
        chunks: hasSpeech ? captionChunks(words) : null,
        engine: hasSpeech ? rt.label + (detected ? ` · langue détectée : ${LANG[detected] ?? detected}` : "") : "",
      };
      setSrc(s);
      setNotice(note);
      setClips(choose(s, n, len));
      setStage(null);
      setPhase("pret");
      ping("clips-ready");
    } catch {
      if (!ctrl.signal.aborted) { setPhase("erreur"); ping("error"); }
    }
  }

  // A file handed over from the home composer starts right away
  useEffect(() => {
    // analyse() only sets state after its first await; the microtask makes that explicit
    if (handoff) queueMicrotask(() => void analyse(handoff.file, handoff.count ?? 8, handoff.length ?? 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  function pick(f?: File) {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setClips([]);
    setSrc(null);
    setStage(null);
    setSpeechStart(0);
    setNotice("");
    setPhase("analyse");
    void analyse(f, count, length);
  }

  function answer(v: Voice) {
    if (!ask) return;
    ping(v === "yes" ? "voice-yes" : "voice-no");
    setPhase("analyse");
    setAsk(null);
    void analyse(ask.f, ask.n, ask.len, v);
  }

  // New settings reuse the transcript: instant
  function rerun() {
    if (src) setClips(choose(src, count, length));
  }

  const update = (id: string, patch: Partial<Clip>) => setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function shift(c: Clip, dir: -1 | 1) {
    if (!src) return;
    if (src.sents && c.i !== undefined) {
      const m = shiftBySentence(src.sents, c as TMoment, dir, src.z, HOP, src.duration);
      if (m.i === c.i) return;
      setClips((cs) => cs.map((x) => (x.id === c.id ? toClip(m, { focus: c.focus, hookId: c.hooks[c.hook]?.id }) : x)));
      return;
    }
    const m = shiftMoment(src.env, c, dir, src.duration);
    update(c.id, { start: m.start, end: m.end, hooks: [{ ...c.hooks[0], segs: [{ start: m.start, end: m.end }] }], out: undefined, error: undefined });
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

  function toggleCaptions() {
    setCaptions((v) => !v);
    setClips((cs) => cs.map((c) => ({ ...c, out: undefined })));
  }

  async function render(c: Clip, n: number): Promise<{ url: string; ext: string } | null> {
    const hook = c.hooks[c.hook];
    update(c.id, { progress: 0, out: undefined, error: undefined });
    try {
      const r = await exportClip(url, hook.segs, c.focus, { captions: captions ? src?.chunks : null, endCard, onProgress: (p) => update(c.id, { progress: p }) });
      const out = { url: URL.createObjectURL(r.blob), ext: r.ext };
      update(c.id, { progress: undefined, out });
      pingClipMade();
      const name = file?.name.replace(/\.[^.]+$/, "") ?? "vidéo";
      await addCreation({ tool: "propagande", title: `Moment ${n} · ${SHORT[hook.id]} · ${name}`, source: file?.name ?? "", start: c.start, end: c.end, ext: r.ext, score: c.score }, r.blob).catch(() => {});
      return out;
    } catch (e) {
      update(c.id, { progress: undefined, error: e instanceof Error ? e.message : "L'export a échoué." });
      ping("export-fail");
      return null;
    }
  }

  function save(out: { url: string; ext: string }, n: number, c: Clip) {
    const a = document.createElement("a");
    a.href = out.url;
    a.download = `propagande-${n}-${c.hooks[c.hook].id}.${out.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadAll() {
    const list = [...clips];
    for (let k = 0; k < list.length; k++) {
      setBatch({ i: k + 1, n: list.length });
      const c = list[k];
      const out = c.out ?? (await render(c, k + 1));
      if (out) save(out, k + 1, c);
    }
    setBatch(null);
  }

  const busy = batch !== null || clips.some((c) => c.progress !== undefined);
  const st = stageText(stage, speechStart);

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
              <Button variant="secondary" onClick={rerun} disabled={phase !== "pret" || busy}>Relancer</Button>
              <button type="button" role="switch" aria-checked={captions && !!src?.chunks} onClick={toggleCaptions} disabled={!src?.chunks || busy}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors disabled:opacity-40 ${captions && src?.chunks ? "bg-violet text-on-violet" : "border border-glass-rim text-ink-muted"}`}>
                <ClosedCaptioning size={18} aria-hidden /> Sous-titres {captions && src?.chunks ? "oui" : "non"}
              </button>
              <button type="button" role="switch" aria-checked={endCard} onClick={() => { setEndCard((v) => !v); setClips((cs) => cs.map((c) => ({ ...c, out: undefined }))); }} disabled={busy}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors disabled:opacity-40 ${endCard ? "bg-violet text-on-violet" : "border border-glass-rim text-ink-muted"}`}>
                Signature « Fait avec Propagande » {endCard ? "oui" : "non"}
              </button>
              <p className="max-w-[52ch] text-[13px] leading-snug text-ink-muted">
                On coupe sur des phrases complètes, on choisit les moments au texte et au son, et on te propose d&apos;ouvrir sur la meilleure phrase.
                {src?.engine && <> Voix transcrite sur ton appareil ({src.engine}).</>}
              </p>
            </div>
          )}
          {open === "source" && <SourcePanel url={url} env={src?.env ?? null} duration={src?.duration ?? 0} clips={clips} />}

          {notice && <p role="status" className="glass rounded-[16px] px-4 py-3 text-[14px] text-ink-muted">{notice}</p>}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-label="Clips" aria-busy={phase === "analyse"} className="min-w-0">
              {phase === "analyse" && (
                <>
                  <div className="mb-3 flex flex-col gap-2" role="status">
                    <p className="text-[15px] text-ink-muted">{st.text}</p>
                    <div className="h-1.5 w-full max-w-[520px] overflow-hidden rounded-full bg-line">
                      {st.p === null
                        ? <div className="iri-fill h-full w-1/3 animate-pulse rounded-full" />
                        : <div className="h-full rounded-full bg-corail transition-[width] duration-300" style={{ width: `${Math.round(st.p * 100)}%` }} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
                    {Array.from({ length: count }, (_, i) => <div key={i} className="aspect-[9/16] animate-pulse rounded-[22px] bg-line/60" />)}
                  </div>
                </>
              )}
              {phase === "accord" && ask && <FirstRun ask={ask} onYes={() => answer("yes")} onNo={() => answer("no")} />}
              {phase === "erreur" && <p className="rounded-[18px] border border-rec p-4 text-[15px]">On n&apos;a pas pu lire le son de cette vidéo. Essaie un MP4 ou un MOV.</p>}
              {phase === "pret" && !clips.length && <p className="glass rounded-[18px] p-4 text-[15px] text-ink-muted">Aucun moment gardé. Relance avec d&apos;autres réglages, ou change de vidéo.</p>}
              {phase === "pret" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
                  {clips.map((c, i) => (
                    <ClipCard key={c.id} n={i + 1} c={c} src={url} chunks={captions ? src?.chunks ?? null : null} disabled={busy}
                      onHook={(k) => update(c.id, { hook: k, out: undefined })}
                      onFocus={(f) => update(c.id, { focus: f, out: undefined })}
                      onEarlier={() => shift(c, -1)} onLater={() => shift(c, 1)} onRemove={() => remove(c)}
                      onExport={() => render(c, i + 1)} onSave={() => c.out && save(c.out, i + 1, c)} />
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

/** Shown once per browser, before the voice model downloads: the size, and how this device will do. */
function FirstRun({ ask, onYes, onNo }: { ask: Ask; onYes: () => void; onNo: () => void }) {
  return (
    <div role="dialog" aria-labelledby="first-run-title" className="glass light-edge flex max-w-[620px] flex-col gap-4 rounded-[28px] p-6">
      <h2 id="first-run-title" className="font-display text-[24px] leading-tight font-extrabold tracking-[-0.015em]">Première fois : on prépare la voix</h2>
      <p className="text-[16px] leading-relaxed text-ink-muted">
        Propagande écoute ta vidéo directement sur ton appareil. Pour ça, ton navigateur télécharge un modèle de voix de{" "}
        <strong className="text-ink">{ask.sizeMb} Mo</strong>, une seule fois. Les fois suivantes, ça part tout de suite.
      </p>
      {ask.cellular && (
        <p className="rounded-[16px] border border-corail/50 px-4 py-3 text-[15px]">Tu sembles être sur données mobiles. Si ton forfait est limité, attends le Wi-Fi.</p>
      )}
      {ask.cpu && (
        <p className="rounded-[16px] border border-corail/50 px-4 py-3 text-[15px]">
          Ce navigateur n&apos;a pas accès à ta carte graphique : la transcription sera beaucoup plus lente, avec un modèle plus petit. Chrome ou Edge à jour, sur ordinateur, donne le meilleur résultat.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onYes}><DownloadSimple size={18} weight="bold" aria-hidden /> Télécharger la voix ({ask.sizeMb} Mo)</Button>
        <Button variant="secondary" onClick={onNo}>Continuer sans sous-titres</Button>
      </div>
      <p className="text-[13px] text-ink-muted">Le modèle (Whisper, licence MIT) vient de Hugging Face. Ta vidéo, elle, ne quitte jamais ton appareil.</p>
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
      <span className="max-w-[46ch] text-[16px] text-ink-muted">Un live, un podcast, un vlog. Tu reçois les meilleurs moments, déjà en 9:16, sous-titrés, prêts à publier.</span>
      <span className="font-mono text-[13px] text-ink-muted">MP4 · MOV · français, anglais et 90 autres langues</span>
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
function SourcePanel({ url, env, duration, clips }: { url: string; env: Float32Array | null; duration: number; clips: Clip[] }) {
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
          {duration > 0 && clips.map((c) => (
            <button key={c.id} type="button" aria-label={`Lire depuis ${fmtTime(c.start)}`} onClick={() => { if (v.current) { v.current.currentTime = c.start; void v.current.play(); } }}
              className="absolute inset-y-0 bg-corail/30 ring-1 ring-corail hover:bg-corail/45" style={{ left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%` }} />
          ))}
          <div className="pointer-events-none absolute inset-0 flex items-end gap-px px-1">
            {bars.map((x, i) => <span key={i} className="flex-1 rounded-t-sm bg-violet/50" style={{ height: `${Math.max(4, x * 100)}%` }} />)}
          </div>
        </div>
        <div className="flex justify-between font-mono text-[12px] text-ink-muted tabular"><span>0:00</span><span>{fmtTime(duration)}</span></div>
      </div>
    </section>
  );
}

function ClipCard({ n, c, src, chunks, disabled, onHook, onFocus, onEarlier, onLater, onRemove, onExport, onSave }: {
  n: number; c: Clip; src: string; chunks: Chunk[] | null; disabled: boolean;
  onHook: (k: number) => void; onFocus: (f: number) => void; onEarlier: () => void; onLater: () => void; onRemove: () => void; onExport: () => void; onSave: () => void;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reframe, setReframe] = useState(false);
  const [cap, setCap] = useState<{ words: string[]; active: number; key: number } | null>(null);
  const [cut, setCut] = useState(0);
  const drag = useRef<{ x: number; f: number; w: number } | null>(null);
  const raf = useRef(0);
  const hook = c.hooks[c.hook];
  const segs = hook.segs;
  const first = segs[0].start;

  // Show the first frame of the chosen opening while stopped
  useEffect(() => {
    if (v.current) v.current.currentTime = first + 0.05;
  }, [first]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function stop() {
    cancelAnimationFrame(raf.current);
    v.current?.pause();
    setPlaying(false);
    setCap(null);
  }

  function play() {
    const el = v.current;
    if (!el) return;
    let k = 0;
    el.currentTime = segs[0].start;
    void el.play();
    setPlaying(true);
    const tick = () => {
      const t = el.currentTime;
      if (t >= segs[k].end) {
        if (k + 1 >= segs.length) { stop(); el.currentTime = first + 0.05; return; }
        k++;
        el.currentTime = segs[k].start;
        setCut((x) => x + 1);
      }
      const at = chunks ? captionAt(chunks, t) : null;
      setCap((prev) => {
        if (!at) return null;
        const key = at.chunk.t0;
        if (prev && prev.key === key && prev.active === at.active) return prev;
        return { words: at.chunk.words.map((w) => capText(w.w)), active: at.active, key };
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  const toggle = () => {
    if (reframe) return;
    if (playing) stop();
    else play();
  };
  const pickHook = (k: number) => { stop(); onHook(k); };
  const exporting = c.progress !== undefined;

  return (
    <article className="glass flex flex-col gap-2.5 rounded-[24px] p-2.5">
      <div
        className={`@container relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-black ${reframe ? "cursor-ew-resize ring-2 ring-corail" : "cursor-pointer"}`}
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
        <video ref={v} src={src} playsInline preload="metadata" className="h-full w-full object-cover" style={{ objectPosition: `${c.focus * 100}% 50%` }} />
        {cut > 0 && playing && <span key={cut} className="cut-flash pointer-events-none absolute inset-0 bg-white" />}
        {cap && (
          <p aria-hidden className="caption-text pointer-events-none absolute inset-x-[7%] top-[70%] -translate-y-1/2 text-center text-[8.5cqw] leading-[1.12] font-extrabold">
            {cap.words.map((w, k) => <span key={k} className={k === cap.active ? "text-corail" : "text-white"}>{w}{k < cap.words.length - 1 ? " " : ""}</span>)}
          </p>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[12px] text-white tabular backdrop-blur">#{n} · {fmtTime(segsLength(segs))}</span>
        {!playing && !reframe && <span className="absolute inset-0 flex items-center justify-center"><span className="glass flex size-12 items-center justify-center rounded-full"><Play size={22} weight="fill" aria-hidden /></span></span>}
        {reframe && (
          <span className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-black/60 py-2 text-[13px] font-semibold text-white">
            <ArrowsOutLineHorizontal size={16} aria-hidden /> Glisse pour recadrer
          </span>
        )}
      </div>

      {c.hooks.length > 1 && (
        <div role="radiogroup" aria-label="Ouverture du clip" className="flex gap-1 rounded-full bg-surface-200 p-1">
          {c.hooks.map((h, k) => (
            <button key={h.id} type="button" role="radio" aria-checked={k === c.hook} onClick={() => pickHook(k)} disabled={disabled}
              className={`h-8 flex-1 rounded-full px-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50 ${k === c.hook ? "bg-corail text-on-corail" : "text-ink-muted hover:text-ink"}`}>
              {SHORT[h.id]}
            </button>
          ))}
        </div>
      )}
      {hook.line && <p className="line-clamp-2 px-1 text-[13px] leading-snug" title={hook.line}>« {hook.line} »</p>}

      <div className="flex flex-wrap gap-1.5 px-0.5">
        {c.reasons.map((r) => <span key={r} className="rounded-full border border-glass-rim px-2.5 py-0.5 text-[12px] font-semibold text-ink-muted">{r}</span>)}
      </div>

      <div className="grid grid-cols-4 gap-1">
        <Verb label="Plus tôt" onClick={() => { stop(); onEarlier(); }} disabled={disabled || reframe}><ArrowLeft size={18} aria-hidden /></Verb>
        <Verb label="Plus tard" onClick={() => { stop(); onLater(); }} disabled={disabled || reframe}><ArrowRight size={18} aria-hidden /></Verb>
        <Verb label={reframe ? "OK" : "Recadrer"} onClick={() => { setReframe((r) => !r); stop(); }} disabled={disabled} on={reframe}>
          {reframe ? <Check size={18} weight="bold" aria-hidden /> : <ArrowsOutLineHorizontal size={18} aria-hidden />}
        </Verb>
        <Verb label="Retirer" onClick={() => { stop(); onRemove(); }} disabled={disabled || reframe}><Trash size={18} aria-hidden /></Verb>
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
