import Link from "next/link";
import { LazyVideo } from "@/components/media/lazy-video";
import { tools } from "@/lib/showcase";

/** The four sections as big media cards, like a tool row. */
export function ToolCards() {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:px-0">
      {tools.map((t) => (
        <Link key={t.title} href={t.href} className="group relative w-[72vw] shrink-0 snap-start overflow-hidden rounded-[24px] border border-glass-rim bg-surface-200 sm:w-[300px] md:w-auto">
          <div className="relative aspect-[4/3] overflow-hidden">
            <LazyVideo slug={t.clip} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-200 via-transparent to-transparent" />
            {t.soon && <span className="glass absolute top-3 left-3 rounded-full px-2.5 py-1 text-[12px] font-semibold">Bientôt</span>}
          </div>
          <div className="flex flex-col gap-1 p-4 pt-1">
            <h3 className="font-display text-[20px] font-bold uppercase tracking-[-0.01em]">{t.title}</h3>
            <p className="text-[14px] leading-snug text-ink-muted">{t.body}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
