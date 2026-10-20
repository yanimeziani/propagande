import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { FeelsIllegal } from "@/components/brand/feels-illegal";
import { ToolName } from "@/components/brand/tool-name";
import { Composer } from "@/components/home/composer";
import { MediaSection } from "@/components/home/media-section";
import { LazyVideo } from "@/components/media/lazy-video";
import { HeroWall } from "@/components/site/hero-wall";
import { ButtonLink } from "@/components/ui/button";
import { sections } from "@/lib/showcase";

const tools = [
  {
    id: "propagande",
    name: "Propagande",
    pitch: "Une vidéo longue devient des clips verticaux qui tournent partout.",
    steps: ["Dépose ton live, ton podcast ou ton vlog.", "On trouve les moments qui accrochent, coupés au bout de la phrase.", "Sous-titres, cadrage 9:16 sur ton visage, prêt à publier."],
    clips: [{ slug: "rap-foule", label: "Moment fort" }, { slug: "ton-chalet", label: "Crochet" }, { slug: "type", label: "Sous-titres" }],
    cta: "Essayer Propagande",
    tone: "corail",
  },
  {
    id: "agent-double",
    name: "Agent double",
    pitch: "Ta scène, un autre personnage. Même mouvements, même lumière, même son.",
    steps: ["Dépose ta vidéo et touche la personne à remplacer.", "Choisis le nouveau personnage : inventé, ou une vraie personne qui a dit oui.", "Brouillon d'abord, version finale après ton OK."],
    clips: [{ slug: "fumee", label: "Personnage IA" }, { slug: "eclaboussure", label: "Personnage IA" }, { slug: "fenetre-auto", label: "Personnage IA" }],
    cta: "Voir Agent double",
    tone: "violet",
  },
] as const;

export default function HomePage() {
  const [mode, cinema] = sections;
  return (
    <>
      {/* Hero: the tilted wall, the glass mark, the stamp, one line */}
      <section className="relative isolate flex min-h-[88svh] items-center justify-center overflow-hidden px-4 py-24">
        <HeroWall columns={6} />
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 text-center">
          <FeelsIllegal />
          <h1 className="font-display text-[46px] leading-[0.98] font-extrabold tracking-[-0.025em] text-balance md:text-[80px]">
            Deux outils qui font{" "}
            <span className="iri-text">tourner tes vidéos.</span>
          </h1>
          <p className="max-w-[48ch] text-[18px] leading-[1.5] text-ink-muted">
            Propagande transforme une vidéo longue en clips qui tournent. Agent double change le personnage de ta scène.
          </p>
          <Composer />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 md:gap-20 md:px-6">
        {/* The two tools */}
        {tools.map((t, ti) => (
          <section key={t.id} id={t.id} className="glass light-edge grid scroll-mt-24 items-center gap-8 rounded-[36px] p-6 md:grid-cols-2 md:p-10" aria-labelledby={`${t.id}-t`}>
            <div className={`flex flex-col gap-5 ${ti % 2 ? "md:order-2" : ""}`}>
              <div className="flex items-center gap-3">
                <h2 id={`${t.id}-t`} className="text-[48px] leading-none md:text-[68px]"><ToolName tool={t.id} /></h2>
              </div>
              <p className="max-w-[40ch] text-[20px] leading-snug">{t.pitch}</p>
              <ol className="flex flex-col gap-3">
                {t.steps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-[16px] leading-snug text-ink-muted">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold ${t.tone === "corail" ? "bg-corail text-on-corail" : "bg-violet text-on-violet"}`}>{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <ButtonLink href={`/${t.id}`} variant={t.tone === "corail" ? "primary" : "secondary"} className="w-fit">
                {t.cta} <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {t.clips.map((c, i) => (
                <figure key={c.slug} className={`relative aspect-[9/16] overflow-hidden rounded-[18px] border border-glass-rim bg-surface-200 ${i === 1 ? "-translate-y-4" : ""}`}>
                  <LazyVideo slug={c.slug} className="absolute inset-0 h-full w-full object-cover" />
                  <figcaption className="glass absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">{c.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}

        <MediaSection s={{ ...mode, id: "exemples", title: "Fait avec MadeLucid", sub: "Des personnages IA et des formats qui accrochent, faits par nous." }} />
        <MediaSection s={cinema} />

        {/* Closing band */}
        <section className="relative overflow-hidden rounded-[36px] border border-glass-rim px-6 py-12 text-center md:px-12" style={{ background: "radial-gradient(60% 70% at 50% 110%, color-mix(in srgb, var(--rose) 28%, transparent) 0%, transparent 70%)" }}>
          <h2 className="font-display text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-balance md:text-[44px]">Ta prochaine vidéo commence ici.</h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[17px] text-ink-muted">Dépose une vidéo longue. Propagande en tire les clips.</p>
          <div className="mt-6 flex justify-center"><ButtonLink href="/propagande">Essayer Propagande</ButtonLink></div>
        </section>
      </div>
    </>
  );
}
