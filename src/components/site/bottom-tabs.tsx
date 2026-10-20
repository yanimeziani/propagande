"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatsCircle, MagicWand, PaperPlaneTilt, SquaresFour } from "@phosphor-icons/react";
import { sections } from "@/lib/nav";

const icons = { "/": SquaresFour, "/creer": MagicWand, "/publier": PaperPlaneTilt, "/messages": ChatsCircle } as const;

/** Mobile: four tabs in thumb reach, on a glass bar. The active tab is a violet pill. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="glass fixed inset-x-3 z-40 flex items-center justify-between rounded-full p-1.5 shadow-lift md:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      {sections.map((s) => {
        const Icon = icons[s.href as keyof typeof icons];
        const active = s.match(pathname);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-200 ${active ? "bg-violet text-on-violet" : "text-ink-muted"}`}
          >
            <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
            <span className={active ? "" : "sr-only"}>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
