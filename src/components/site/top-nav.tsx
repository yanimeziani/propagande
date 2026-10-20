"use client";
import Link from "next/link";
import { Question } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

/** Slim top bar. Phones: logo + action (tools live in the bottom tabs). Desktop: the sidebar has the tools, this bar has account-level actions. */
export function TopNav({ compact = false }: { compact?: boolean }) {
  return (
    <header
      className={`sticky top-0 z-40 flex w-full shrink-0 items-center gap-3 border-b border-glass-rim bg-surface-100/80 px-4 backdrop-blur-xl md:px-6 ${compact ? "h-14" : "h-16"}`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="md:hidden"><Logo compact={compact} /></div>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/tarifs" className="hidden h-9 items-center rounded-full px-3 text-[14px] font-semibold text-ink-muted hover:bg-white/5 hover:text-ink md:inline-flex">Tarifs</Link>
        <Link href="/aide" title="Aide" className="hidden size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink md:inline-flex">
          <Question size={20} aria-hidden /><span className="sr-only">Aide</span>
        </Link>
        <ButtonLink href="/propagande" className="h-9 px-4 text-sm">Commencer</ButtonLink>
      </div>
    </header>
  );
}
