import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LazyVideo } from "@/components/media/lazy-video";
import type { ShowSection } from "@/lib/showcase";

/** Section header (uppercase title, one line, « Voir tout ») over a 9:16 bento grid; the first tile is the big one. */
export function MediaSection({ s }: { s: ShowSection }) {
  return (
    <section id={s.id} className="flex scroll-mt-24 flex-col gap-4 rounded-[28px] border border-glass-rim bg-gradient-to-b from-white/[0.05] to-transparent p-4 md:p-6" aria-labelledby={`${s.id}-t`}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={`${s.id}-t`} className="font-display text-[26px] leading-none font-extrabold tracking-[-0.015em] uppercase md:text-[34px]">{s.title}</h2>
          <p className="text-[15px] text-ink-muted">{s.sub}</p>
        </div>
        <Link href={s.href} className="glass hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold hover:bg-white/10 sm:inline-flex">
          Voir tout <ArrowRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {s.tiles.map((t, i) => (
          <Link
            key={t.slug}
            href={s.href}
            className={`group relative overflow-hidden rounded-[18px] border border-glass-rim bg-surface-200 ${i === 0 ? "col-span-2 aspect-[4/5] sm:row-span-2 sm:aspect-auto" : "aspect-[9/16]"}`}
          >
            <LazyVideo slug={t.slug} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute bottom-2.5 left-3 text-[13px] font-semibold text-white">{t.label}</span>
          </Link>
        ))}
      </div>
      <Link href={s.href} className="glass inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold sm:hidden">
        Voir tout <ArrowRight size={16} weight="bold" aria-hidden />
      </Link>
    </section>
  );
}
