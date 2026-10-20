import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { formats } from "@/lib/formats";
import { sections } from "@/lib/showcase";

const cols = [
  { title: "Produit", links: [["Formats", "/#formats"], ["Créer", "/creer"], ["Publier", "/publier"], ["Messages", "/messages"], ["Tarifs", "/tarifs"]] },
  { title: "Formats", links: formats.slice(0, 5).map((f) => [f.title, `/creer?format=${f.slug}`]) },
  { title: "Catégories", links: sections.map((s) => [s.title, `/#${s.id}`]) },
];

/** Mega footer: a big line, then link columns that all go to real pages. */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-glass-rim">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-14 pb-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-6 md:pb-14">
        <div className="flex flex-col gap-5">
          <Logo />
          <p className="font-display text-[34px] leading-[0.95] font-extrabold tracking-[-0.02em] uppercase md:text-[44px]">
            Des vidéos qui marchent, <span className="bg-gradient-to-r from-corail via-rose to-violet bg-clip-text text-transparent">en français.</span>
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-2.5">
            <span className="font-mono text-[12px] tracking-[0.08em] text-ink-muted uppercase">{c.title}</span>
            {c.links.map(([label, href]) => (
              <Link key={href} href={href} className="text-[15px] text-ink/85 hover:text-ink">{label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-glass-rim px-4 py-6 pb-28 text-[13px] text-ink-muted md:flex-row md:justify-between md:px-6 md:pb-6">
        <span>Fait au Québec. Code ouvert (AGPL).</span>
        <span>© {new Date().getFullYear()} MadeLucid</span>
      </div>
    </footer>
  );
}
