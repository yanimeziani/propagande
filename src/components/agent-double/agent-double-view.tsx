"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, ImageSquare, UploadSimple, VideoCamera } from "@phosphor-icons/react";
import { ToolHeader } from "@/components/site/tool-header";
import { Button } from "@/components/ui/button";
import { fmtTime } from "@/lib/clips/analyze";
import { takeHandoff } from "@/lib/handoff";

type Target = { x: number; y: number; t: number };
type Who = "ia" | "reelle";

const STEPS = [
  { k: "suivre", label: "Suivre la personne", detail: "Le masque suit la personne sur chaque image (SAM 2)." },
  { k: "profondeur", label: "Profondeur et pose", detail: "Le nouveau personnage bouge comme l'original." },
  { k: "generer", label: "Générer", detail: "Le personnage est peint dans la scène (Wan VACE, hébergé chez nous)." },
  { k: "composer", label: "Composer", detail: "Bords, couleur et grain ajustés à ta vidéo." },
  { k: "son", label: "Son original", detail: "On remet le son de ta vidéo, intact." },
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
  const v = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const ready = !!video && !!image && !!target && ownVideo && (who === "ia" || consent);
  const missing = [!video && "la scène", !target && "la personne à remplacer", !image && "le nouveau personnage", !ownVideo && "tes droits sur la vidéo", who === "reelle" && !consent && "le consentement"].filter(Boolean) as string[];

  function mark(e: React.MouseEvent<HTMLDivElement>) {
    const el = v.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.pause();
    setTarget({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, t: el.currentTime });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pb-32 md:p-6">
      <ToolHeader tool="agent-double" line="Ta scène, un autre personnage. Même mouvements, même lumière, même son." note="Tes fichiers restent sur ton appareil pour l'instant." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* 1. Scene + target */}
        <section className="glass flex min-w-0 flex-col gap-3 rounded-[24px] p-4" aria-labelledby="scene">
          <h2 id="scene" className="flex items-center gap-2 text-[15px] font-semibold"><Step n={1} done={!!target} /> La scène et la personne à remplacer</h2>
          {!video ? (
            <Drop accept="video/*" icon={<VideoCamera size={28} weight="bold" />} title="Dépose ta vidéo" sub="10 secondes ou moins pour commencer. MP4 ou MOV."
              onPick={(f) => { setVideo({ url: URL.createObjectURL(f), name: f.name }); setTarget(null); }} />
          ) : (
            <>
              <div className="relative overflow-hidden rounded-[18px] bg-black">
                <video ref={v} src={video.url} controls playsInline className="block max-h-[60vh] w-full object-contain" />
                <div role="button" tabIndex={0} aria-label="Toucher la personne à remplacer" onClick={mark}
                  onKeyDown={(e) => { if (e.key === "Enter" && v.current) setTarget({ x: 0.5, y: 0.5, t: v.current.currentTime }); }}
                  className="absolute inset-x-0 top-0 bottom-12 cursor-crosshair" />
                {target && (
                  <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}>
                    <span className="block size-10 rounded-full border-[3px] border-corail bg-corail/25 shadow-[0_0_0_6px_rgba(255,90,60,0.25)]" />
                  </span>
                )}
              </div>
              <p className="flex items-center gap-2 text-[14px] text-ink-muted">
                <Crosshair size={18} aria-hidden />
                {target ? <>Cible posée à <span className="font-mono tabular">{fmtTime(target.t)}</span>. Touche ailleurs pour la déplacer.</> : "Mets sur pause, puis touche la personne à remplacer."}
              </p>
              <button type="button" onClick={() => { setVideo(null); setTarget(null); }} className="w-fit text-[14px] font-semibold text-lilas hover:underline">Changer de vidéo</button>
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
          <span className="glass rounded-full px-3 py-1 font-mono text-[12px] text-ink-muted">Moteur GPU en préparation</span>
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
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled className="disabled:cursor-not-allowed disabled:opacity-60">Générer un brouillon (bientôt)</Button>
          <p className="text-[14px] text-ink-muted">
            {ready ? "Tout est prêt. Le brouillon 480p sera généré dès que le moteur est en ligne, puis la version finale après ton OK." : `Il manque : ${missing.join(", ")}.`}
          </p>
        </div>
      </section>
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`flex size-6 items-center justify-center rounded-full text-[12px] font-bold ${done ? "bg-ok text-on-corail" : "border border-glass-rim text-ink-muted"}`}>
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
