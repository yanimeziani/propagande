"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Detective, House, MegaphoneSimple } from "@phosphor-icons/react";
import { sections } from "@/lib/nav";

const icons = { "/propagande": MegaphoneSimple, "/agent-double": Detective } as const;

/** Mobile: home + the two tools, in thumb reach, on a glass bar. The active tab is a violet pill. */
export function BottomTabs() {
  const pathname = usePathname();
  const tabs = [{ href: "/", label: "Accueil", match: (p: string) => p === "/", Icon: House }, ...sections.map((s) => ({ ...s, Icon: icons[s.href as keyof typeof icons] }))];
  return (
    <nav
      aria-label="Sections"
      className="glass fixed inset-x-3 z-40 flex items-center justify-between gap-1 rounded-full p-1.5 shadow-lift md:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      {tabs.map(({ href, label, match, Icon }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-200 ${active ? "bg-violet text-on-violet" : "text-ink-muted"}`}
          >
            <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
            <span className={active ? "" : "sr-only"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
