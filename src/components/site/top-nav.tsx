"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { extra, sections } from "@/lib/nav";

/** Slim top bar: logo · sections · credits · primary action. `compact` is the studio variant. */
export function TopNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <header
      className={`sticky top-0 z-40 flex w-full shrink-0 items-center gap-4 border-b border-glass-rim bg-surface-100/80 px-4 backdrop-blur-xl md:px-6 ${compact ? "h-14" : "h-16"}`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <Logo compact={compact} />
      <nav aria-label="Principal" className="ml-4 hidden min-w-0 flex-1 items-center gap-1 md:flex">
        {[...sections, ...extra].map((l) => {
          const active = l.match(pathname);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${active ? "bg-violet text-on-violet" : "text-ink-muted hover:bg-white/5 hover:text-ink"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span className="glass hidden h-9 items-center gap-2 rounded-full px-3 font-mono text-[13px] text-ink-muted tabular sm:inline-flex">
          <span className="size-2 rounded-full bg-corail" aria-hidden />
          0 crédit
        </span>
        <ButtonLink href="/propagande" className="h-9 px-4 text-sm">
          Commencer
        </ButtonLink>
      </div>
    </header>
  );
}
