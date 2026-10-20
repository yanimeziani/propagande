import Link from "next/link";
import { FeelsIllegal } from "@/components/brand/feels-illegal";
import { Logo } from "@/components/brand/logo";
import { ToolName } from "@/components/brand/tool-name";
import { sections } from "@/lib/showcase";

const cols = [
  { title: "Outils", links: [["Propagande", "/propagande"], ["Agent double", "/agent-double"], ["Tarifs", "/tarifs"]] },
  { title: "Exemples", links: sections.map((s) => [s.title, `/#${s.id}`]) },
];

/** Footer: the line, the stamp, and link columns that only point to real pages. */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-glass-rim">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-14 pb-10 md:grid-cols-[1.6fr_repeat(2,1fr)] md:px-6">
        <div className="flex flex-col items-start gap-5">
          <Logo />
          <p className="flex flex-col gap-1 text-[40px] leading-[0.95] md:text-[52px]">
            <ToolName tool="propagande" className="text-corail" />
            <ToolName tool="agent-double" className="text-lilas" />
          </p>
          <FeelsIllegal />
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
