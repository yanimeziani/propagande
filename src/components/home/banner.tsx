import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";

type Tone = "corail" | "violet";
const tones: Record<Tone, { bg: string; ink: string; sub: string; btn: "secondary" | "primary" }> = {
  corail: { bg: "bg-corail", ink: "text-on-corail", sub: "text-on-corail/75", btn: "secondary" },
  violet: { bg: "bg-violet", ink: "text-on-violet", sub: "text-on-violet/80", btn: "primary" },
};

/** Full-width color block that breaks the rhythm between media sections. */
export function Banner({ tone, eyebrow, title, body, cta, href, side }: { tone: Tone; eyebrow: string; title: string; body: string; cta: string; href: string; side?: ReactNode }) {
  const t = tones[tone];
  return (
    <section className={`relative grid items-center gap-6 overflow-hidden rounded-[36px] px-6 py-10 md:grid-cols-[1.2fr_1fr] md:px-12 md:py-14 ${t.bg}`}>
      <div className="flex flex-col items-start gap-4">
        <span className={`font-mono text-[13px] tracking-[0.08em] uppercase ${t.sub}`}>{eyebrow}</span>
        <h2 className={`font-display text-[40px] leading-[0.95] font-extrabold tracking-[-0.02em] uppercase text-balance md:text-[60px] ${t.ink}`}>{title}</h2>
        <p className={`max-w-[44ch] text-[17px] leading-[1.5] ${t.sub}`}>{body}</p>
        <ButtonLink href={href} variant={t.btn} className={tone === "corail" ? "!bg-surface-100 !text-ink hover:!bg-surface-200" : ""}>{cta}</ButtonLink>
      </div>
      {side && <div className="relative">{side}</div>}
    </section>
  );
}
