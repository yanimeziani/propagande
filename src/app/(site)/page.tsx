import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GlassLoop } from "@/components/brand/glass-loop";
import { HeroWall } from "@/components/site/hero-wall";
import { FormatCard } from "@/components/formats/format-card";
import { ButtonLink } from "@/components/ui/button";
import { formats } from "@/lib/formats";

const steps = [
  { title: "Trouve ton format", body: "Des formats qui marchent déjà, expliqués plan par plan." },
  { title: "Filme avec ton téléphone", body: "3 à 5 plans, guidés. Pas besoin de savoir monter." },
  { title: "Publie, puis réponds", body: "On monte, on publie au bon moment, et les réponses arrivent dans Messages." },
];

export default function ExplorePage() {
  const trending = formats.filter((f) => f.trending).concat(formats.filter((f) => !f.trending));
  return (
    <>
      {/* Hero: the tilted wall of videos, the glass mark, one line, one action */}
      <section className="relative isolate flex min-h-[86svh] items-center justify-center overflow-hidden px-4 py-24">
        <HeroWall columns={6} />
        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/m-glass-logo.webp" alt="" className="h-20 w-auto motion-reduce:hidden" />
          <span className="font-mono text-[13px] tracking-[0.08em] text-ink-muted uppercase">Formats vidéo · en français</span>
          <h1 className="font-display text-[46px] leading-[0.98] font-extrabold tracking-[-0.025em] text-balance md:text-[80px]">
            Trouve ton format. Filme. <span className="bg-gradient-to-r from-corail via-rose to-violet bg-clip-text text-transparent">Publie.</span>
          </h1>
          <p className="max-w-[46ch] text-[18px] leading-[1.5] text-ink-muted">
            Choisis une vidéo qui marche déjà. Filme 3 plans avec ton téléphone. On s&apos;occupe du montage et de la publication.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/creer">
              Créer ma première vidéo <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
            <ButtonLink href="#formats" variant="secondary">
              Voir les formats
            </ButtonLink>
          </div>
        </div>
      </section>

    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pt-6 md:px-6">
      {/* Trending row */}
      <section className="flex flex-col gap-5" aria-labelledby="tendance">
        <div className="flex items-end justify-between gap-4">
          <h2 id="tendance" className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.015em] md:text-[36px]">
            Ce qui marche cette semaine
          </h2>
          <span className="font-mono text-[13px] text-ink-muted tabular">{formats.length} formats</span>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {trending.map((f) => (
            <div key={f.slug} className="w-[62vw] shrink-0 snap-start sm:w-[240px]">
              <FormatCard f={f} />
            </div>
          ))}
        </div>
      </section>

      {/* How it works: a real sequence, so it's numbered */}
      <section className="flex flex-col gap-5" aria-labelledby="comment">
        <h2 id="comment" className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.015em] md:text-[36px]">
          Comment ça marche
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="glass light-edge flex flex-col gap-3 rounded-[24px] p-6">
              <span className="font-mono text-[13px] text-lilas tabular">0{i + 1}</span>
              <h3 className="font-display text-[22px] leading-tight font-bold">{s.title}</h3>
              <p className="text-[16px] leading-[1.5] text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* All formats */}
      <section id="formats" className="flex scroll-mt-24 flex-col gap-5" aria-labelledby="tous">
        <h2 id="tous" className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.015em] md:text-[36px]">
          Tous les formats
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {formats.map((f) => (
            <FormatCard key={f.slug} f={f} />
          ))}
        </div>
      </section>

      {/* Closing band */}
      <section className="glass light-edge relative overflow-hidden rounded-[36px] px-6 py-12 text-center md:px-12">
        <GlassLoop className="mx-auto -mt-4 mb-2 w-full max-w-[260px]" />
        <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "radial-gradient(50% 80% at 50% 120%, var(--rose) 0%, transparent 70%)" }} aria-hidden />
        <h2 className="font-display text-[32px] leading-tight font-extrabold tracking-[-0.015em] text-balance md:text-[44px]">Ta prochaine vidéo, ce soir.</h2>
        <p className="mx-auto mt-3 max-w-[44ch] text-[17px] text-ink-muted">Choisis un format, filme 3 plans, on fait le reste.</p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/creer">Commencer</ButtonLink>
        </div>
      </section>
    </div>
    </>
  );
}
