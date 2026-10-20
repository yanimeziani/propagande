import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GlassLoop } from "@/components/brand/glass-loop";
import { FormatCard } from "@/components/formats/format-card";
import { Banner } from "@/components/home/banner";
import { MediaSection } from "@/components/home/media-section";
import { PromptBox } from "@/components/home/prompt-box";
import { ToolCards } from "@/components/home/tool-cards";
import { LazyVideo } from "@/components/media/lazy-video";
import { HeroWall } from "@/components/site/hero-wall";
import { ButtonLink } from "@/components/ui/button";
import { formats } from "@/lib/formats";
import { sections } from "@/lib/showcase";

const steps = [
  { title: "Trouve ton format", body: "Des formats qui marchent déjà, expliqués plan par plan." },
  { title: "Filme avec ton téléphone", body: "3 à 5 plans, guidés. Pas besoin de savoir monter." },
  { title: "Publie, puis réponds", body: "On monte, on publie au bon moment, et les réponses arrivent dans Messages." },
];

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="font-display text-[26px] leading-none font-extrabold tracking-[-0.015em] uppercase md:text-[34px]">{children}</h2>;
}

export default function ExplorePage() {
  const [mode, cinema, motion, quotidien] = sections;
  return (
    <>
      {/* Hero: the tilted wall of videos, the glass mark, one line, one action */}
      <section className="relative isolate flex min-h-[80svh] items-center justify-center overflow-hidden px-4 py-24">
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
            <ButtonLink href="#formats" variant="secondary">Voir les formats</ButtonLink>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 md:gap-20 md:px-6">
        {/* Prompt box, OpenArt-style */}
        <div className="-mt-16 relative z-10">
          <PromptBox />
        </div>

        {/* Tool row */}
        <section className="flex flex-col gap-4" aria-labelledby="outils">
          <H2 id="outils">Tout pour ta vidéo</H2>
          <ToolCards />
        </section>

        {/* Category tabs → panels */}
        <nav aria-label="Catégories" className="no-scrollbar -mb-10 flex gap-2 overflow-x-auto">
          {sections.map((s) => (
            <Link key={s.id} href={`#${s.id}`} className="glass h-9 shrink-0 rounded-full px-4 text-[14px] leading-9 font-semibold text-ink-muted hover:text-ink">
              {s.title}
            </Link>
          ))}
        </nav>
        <MediaSection s={mode} />

        <Banner
          tone="corail"
          eyebrow="Publier · bientôt"
          title="Un format. Tous tes réseaux."
          body="Instagram, TikTok et YouTube, publiés au bon moment, avec la légende écrite en français."
          cta="Créer une vidéo"
          href="/creer"
          side={<LazyVideo slug="notification" className="mx-auto aspect-[9/16] w-full max-w-[240px] rounded-[28px] border border-black/10 object-cover shadow-lift" />}
        />

        <MediaSection s={cinema} />
        <MediaSection s={motion} />

        <Banner
          tone="violet"
          eyebrow="Messages · bientôt"
          title="Tes commentaires deviennent des clients."
          body="Quelqu'un écrit « je veux » sous ta vidéo : une réponse en français part tout de suite, et la personne arrive dans tes messages."
          cta="Voir comment"
          href="/messages"
          side={<LazyVideo slug="doigts" className="mx-auto aspect-[9/16] w-full max-w-[240px] rounded-[28px] border border-white/15 object-cover shadow-lift" />}
        />

        {/* How it works: a real sequence, so it's numbered */}
        <section className="flex flex-col gap-4" aria-labelledby="comment">
          <H2 id="comment">Comment ça marche</H2>
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

        <MediaSection s={quotidien} />

        {/* All formats */}
        <section id="formats" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="tous">
          <div className="flex items-end justify-between">
            <H2 id="tous">Tous les formats</H2>
            <span className="font-mono text-[13px] text-ink-muted tabular">{formats.length} formats</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
            {formats.map((f) => <FormatCard key={f.slug} f={f} />)}
          </div>
        </section>

        {/* Explore more: chip cloud */}
        <section className="flex flex-col items-center gap-5 text-center" aria-labelledby="plus">
          <H2 id="plus">Explore tous les formats</H2>
          <div className="flex max-w-4xl flex-wrap justify-center gap-2">
            {[...formats.map((f) => ({ k: f.slug, t: f.title, h: `/creer?format=${f.slug}` })), ...sections.flatMap((s) => s.tiles.map((t) => ({ k: `${s.id}-${t.slug}`, t: t.label, h: `#${s.id}` })))].map((c) => (
              <Link key={c.k} href={c.h} className="glass h-9 rounded-full px-3.5 text-[13.5px] leading-9 font-semibold text-ink-muted hover:text-ink">
                {c.t}
              </Link>
            ))}
          </div>
        </section>

        {/* Closing band */}
        <section className="relative overflow-hidden rounded-[36px] border border-glass-rim px-6 py-12 text-center md:px-12" style={{ background: "radial-gradient(60% 70% at 50% 110%, color-mix(in srgb, var(--rose) 28%, transparent) 0%, transparent 70%)" }}>
          <GlassLoop className="mx-auto -mt-4 mb-2 w-full max-w-[260px]" />
          <h2 className="font-display text-[32px] leading-tight font-extrabold tracking-[-0.015em] text-balance md:text-[44px]">Ta prochaine vidéo, ce soir.</h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[17px] text-ink-muted">Choisis un format, filme 3 plans, on fait le reste.</p>
          <div className="mt-6 flex justify-center"><ButtonLink href="/creer">Commencer</ButtonLink></div>
        </section>
      </div>
    </>
  );
}
