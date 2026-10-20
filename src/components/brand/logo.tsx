import Link from "next/link";

/** The keyed glass « m » (animated, transparent) plus the lowercase wordmark. Still image for reduced motion. */
export function Logo({ compact = false }: { compact?: boolean }) {
  const h = compact ? 30 : 34;
  return (
    <Link href="/" aria-label="MadeLucid, accueil" className="flex shrink-0 items-center gap-2 rounded-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/m-glass-logo.webp" alt="" height={h} style={{ height: h, width: "auto" }} className="motion-reduce:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/m-glass-logo.png" alt="" height={h} style={{ height: h, width: "auto" }} className="hidden motion-reduce:block" />
      <span className="font-display text-[20px] leading-none font-extrabold tracking-[-0.02em] text-ink">madelucid</span>
    </Link>
  );
}
