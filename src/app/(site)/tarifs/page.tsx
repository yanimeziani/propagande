import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@/components/ui/button";
import { CONTACT, FREE_FOREVER, FREE_SCOPE_NOTE, PRO, PRO_PRICE, PRO_SEATS } from "@/lib/offer";

export const metadata: Metadata = { title: "Tarifs", description: "Le coupeur Propagande est gratuit, pour toujours. Pro ajoute la file d'attente et les styles par campagne." };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-16 md:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[44px] leading-[1] font-extrabold tracking-[-0.02em] md:text-[56px]">Tarifs</h1>
        <p className="max-w-[56ch] text-[18px] leading-[1.5] text-ink-muted">{FREE_SCOPE_NOTE}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="free" className="glass light-edge flex flex-col gap-5 rounded-[28px] p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="free" className="text-[24px] font-extrabold">Gratuit</h2>
            <span className="font-mono text-[15px] text-ink-muted">0 $, pour toujours</span>
          </div>
          <ul className="flex flex-col gap-3">
            {FREE_FOREVER.map((f) => (
              <li key={f} className="flex gap-3 text-[16px] leading-snug"><Check size={20} weight="bold" className="mt-0.5 shrink-0 text-corail-ink" aria-hidden />{f}</li>
            ))}
          </ul>
          <ButtonLink href="/propagande" className="mt-auto w-fit">Essayer Propagande</ButtonLink>
        </section>

        <section aria-labelledby="pro" className="glass flex flex-col gap-5 rounded-[28px] p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pro" className="text-[24px] font-extrabold">{PRO.name}</h2>
            <span className="font-mono text-[15px] text-ink-muted">{PRO_PRICE ?? "Prix bientôt"}</span>
          </div>
          <p className="text-[15px] text-ink-muted">Tout ce qui est gratuit, plus ceci. {PRO_SEATS} places, parce que Yani revoit les clips lui-même.</p>
          <ul className="flex flex-col gap-3">
            {PRO.features.map((f) => (
              <li key={f} className="flex gap-3 text-[16px] leading-snug"><Check size={20} weight="bold" className="mt-0.5 shrink-0 text-lilas" aria-hidden />{f}</li>
            ))}
          </ul>
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("Propagande Pro : je réserve ma place")}`}
            className="mt-auto inline-flex h-11 w-fit items-center rounded-full border border-glass-rim px-5 text-[15px] font-semibold hover:bg-white/5">
            Réserver ma place
          </a>
        </section>
      </div>
    </div>
  );
}
