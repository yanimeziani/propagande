"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, Check, Microphone, VideoCamera } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formats } from "@/lib/formats";
import { ModeSwitch } from "@/components/studio/mode-switch";

const times = ["Maintenant", "Ce soir 18 h", "Demain 12 h"];

/** Créer: control panel (left) + canvas (right); on phones they stack and the action stays in thumb reach. */
export function StudioView({ initialSlug, idea }: { initialSlug: string; idea?: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [voice, setVoice] = useState(true);
  const [when, setWhen] = useState(times[1]);
  const f = useMemo(() => formats.find((x) => x.slug === slug) ?? formats[0], [slug]);
  const filmed = f.steps.filter((_, i) => done[`${f.slug}-${i}`]).length;
  const ready = filmed === f.steps.length;
  const left = f.steps.length - filmed;
  const label = ready ? "Monter ma vidéo" : `Filme encore ${left} plan${left > 1 ? "s" : ""}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 pb-40 md:flex-row md:overflow-hidden md:p-4 md:pb-4">
      {/* Control panel */}
      <aside className="glass flex w-full shrink-0 flex-col gap-6 rounded-[24px] p-5 md:w-[340px] md:overflow-y-auto">
        <ModeSwitch active="format" />
        {idea && (
          <div className="flex flex-col gap-1 rounded-[14px] border border-glass-rim p-3">
            <span className="text-[13px] font-semibold text-ink-muted">Ton idée</span>
            <p className="text-[15px] leading-snug">{idea}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="format" className="text-[14px] font-semibold text-ink-muted">Format</label>
          <select
            id="format"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-11 rounded-[14px] border border-glass-rim bg-surface-200 px-3 text-[15px] text-ink"
          >
            {formats.map((x) => (
              <option key={x.slug} value={x.slug}>{x.title}</option>
            ))}
          </select>
          <p className="text-[14px] leading-snug text-ink-muted">{f.hook}</p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[14px] font-semibold text-ink-muted">
            Tes plans <span className="font-mono tabular">· {filmed}/{f.steps.length}</span>
          </legend>
          {f.steps.map((s, i) => {
            const key = `${f.slug}-${i}`;
            const on = !!done[key];
            return (
              <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-[14px] border p-3 transition-colors ${on ? "border-violet bg-violet/15" : "border-glass-rim hover:bg-white/5"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setDone((d) => ({ ...d, [key]: !on }))} />
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-violet text-on-violet" : "border border-glass-rim"}`} aria-hidden>
                  {on && <Check size={14} weight="bold" />}
                </span>
                <span className="flex-1 text-[15px] leading-snug">{s.shot}</span>
                <span className="font-mono text-[12.5px] text-ink-muted tabular">{s.seconds} s</span>
              </label>
            );
          })}
        </fieldset>

        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[15px]"><Microphone size={20} aria-hidden /> Ajouter ma voix</span>
          <button
            type="button"
            role="switch"
            aria-checked={voice}
            onClick={() => setVoice((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition-colors ${voice ? "bg-violet" : "bg-line"}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-[left] duration-200 ${voice ? "left-6" : "left-1"}`} />
            <span className="sr-only">Ajouter ma voix</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-ink-muted">Publier</span>
          <div className="flex flex-wrap gap-2">
            {times.map((t) => (
              <button key={t} type="button" onClick={() => setWhen(t)} aria-pressed={when === t}
                className={`h-9 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${when === t ? "bg-violet text-on-violet" : "glass text-ink-muted hover:text-ink"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:block">
          <Button variant={ready ? "primary" : "secondary"} disabled={!ready} className="w-full disabled:cursor-not-allowed">
            <VideoCamera size={18} weight="bold" aria-hidden /> {label}
          </Button>
        </div>
      </aside>

      {/* Canvas */}
      <section className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto rounded-[24px] border border-glass-rim bg-surface-200/40 p-4 md:p-8" aria-label="Aperçu">
        <div className="relative aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-[36px] border border-glass-rim bg-surface-200 shadow-lift">
          {f.cover ? (
            <Image src={f.cover} alt="" fill sizes="320px" className="object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(70% 50% at 30% 30%, var(--corail) 0%, transparent 70%), radial-gradient(70% 50% at 75% 70%, var(--violet) 0%, transparent 70%)" }} aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
          <div className="absolute top-4 left-4 glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold">
            <span className="size-2 rounded-full bg-rec" aria-hidden /> Aperçu
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
            <p className="font-display text-[22px] leading-tight font-bold text-white text-balance">{f.title}</p>
            <p className="font-mono text-[12.5px] text-white/75 tabular">{f.seconds} s · {f.shots} plans · {voice ? "avec ta voix" : "sans voix"} · {when}</p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-[14px] text-ink-muted">
          <Camera size={18} aria-hidden /> Filme chaque plan avec ton téléphone, à la verticale, puis coche-le.
        </p>
      </section>

      {/* Mobile: the primary action stays in thumb reach, above the tabs */}
      <div className="fixed inset-x-3 z-30 md:hidden" style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
        <Button variant={ready ? "primary" : "secondary"} disabled={!ready} className="w-full shadow-lift">
          {label}
        </Button>
      </div>
    </div>
  );
}
