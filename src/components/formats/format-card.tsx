import Image from "next/image";
import Link from "next/link";
import type { Format } from "@/lib/formats";

const glowBg = { corail: "var(--corail)", rose: "var(--rose)", violet: "var(--violet)" } as const;

/** A format as a 9:16 card: preview, title, then duration · shots · level in mono. */
export function FormatCard({ f, className = "" }: { f: Format; className?: string }) {
  return (
    <Link href={`/creer?format=${f.slug}`} className={`group relative block aspect-[9/16] w-full overflow-hidden rounded-[36px] border border-glass-rim bg-surface-200 ${className}`}>
      {f.cover ? (
        <Image src={f.cover} alt="" fill sizes="(max-width: 768px) 60vw, 280px" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
      ) : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 35%, ${glowBg[f.glow]} 0%, transparent 70%)`, opacity: 0.55 }} aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden />
      <div className="absolute top-3 left-3 flex gap-1.5">
        {f.trending && <span className="rounded-full bg-rose px-2.5 py-1 text-[12px] font-semibold text-on-corail">Tendance</span>}
        <span className="glass rounded-full px-2.5 py-1 text-[12px] font-semibold text-ink">Exemple</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
        <h3 className="font-display text-[20px] leading-[1.15] font-bold text-white text-balance">{f.title}</h3>
        <p className="font-mono text-[12.5px] text-white/75 tabular">
          {f.seconds} s · {f.shots} plans · {f.level}
        </p>
      </div>
    </Link>
  );
}
