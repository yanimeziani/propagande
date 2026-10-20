"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { BookOpen, Detective, FilmStrip, FolderSimple, MegaphoneSimple, Plus, SidebarSimple, Sparkle } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";

type Item = { href?: string; label: string; Icon: typeof Plus; badge?: "Nouveau" | "Bêta" | "Bientôt"; match?: (p: string) => boolean };
const groups: { title: string; items: Item[] }[] = [
  { title: "Outils", items: [
    { href: "/propagande", label: "Propagande", Icon: MegaphoneSimple, badge: "Nouveau", match: (p) => p.startsWith("/propagande") },
    { href: "/agent-double", label: "Agent double", Icon: Detective, badge: "Bêta", match: (p) => p.startsWith("/agent-double") },
  ] },
  { title: "Mes créations", items: [
    { href: "/creations", label: "Clips", Icon: FilmStrip, match: (p) => p.startsWith("/creations") },
    { label: "Projets", Icon: FolderSimple, badge: "Bientôt" },
  ] },
  { title: "Inspiration", items: [
    { href: "/#exemples", label: "Exemples", Icon: Sparkle },
    { label: "Tutoriels", Icon: BookOpen, badge: "Bientôt" },
  ] },
];

function subscribeRail(cb: () => void) {
  window.addEventListener("ml-rail", cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener("ml-rail", cb); window.removeEventListener("storage", cb); };
}
function readRail() {
  try { return localStorage.getItem("ml-rail") === "1"; } catch { return false; }
}

const badgeStyle = { Nouveau: "bg-corail text-on-corail", "Bêta": "bg-violet text-on-violet", "Bientôt": "border border-glass-rim text-ink-muted" } as const;

/** Desktop app shell: grouped tools, collapsible to an icon rail (remembered per browser). */
export function Sidebar() {
  const pathname = usePathname();
  const rail = useSyncExternalStore(subscribeRail, readRail, () => false);
  const toggle = () => {
    try { localStorage.setItem("ml-rail", rail ? "0" : "1"); } catch {}
    window.dispatchEvent(new Event("ml-rail"));
  };

  return (
    <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 border-r border-glass-rim bg-surface-100 p-3 transition-[width] duration-200 md:flex ${rail ? "w-[72px]" : "w-[248px]"}`} aria-label="Navigation">
      <div className={`flex items-center ${rail ? "justify-center" : "justify-between pl-1"}`}>
        {!rail && <Logo compact />}
        <button type="button" onClick={toggle} aria-label={rail ? "Ouvrir le menu" : "Réduire le menu"} className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
          <SidebarSimple size={20} aria-hidden />
        </button>
      </div>

      <Link href="/#composer" className={`flex h-11 items-center justify-center gap-2 rounded-full bg-corail font-semibold text-on-corail shadow-[0_8px_30px_-10px_var(--corail)] hover:brightness-110 ${rail ? "w-11 self-center" : "w-full"}`}>
        <Plus size={18} weight="bold" aria-hidden />
        {!rail && "Nouveau"}
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            {!rail && <span className="px-3 pb-1 font-mono text-[11px] tracking-[0.12em] text-ink-muted uppercase">{g.title}</span>}
            {g.items.map((it) => {
              const active = !!(it.match && it.match(pathname));
              const content = (
                <>
                  <it.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden className="shrink-0" />
                  {!rail && <span className="flex-1 truncate">{it.label}</span>}
                  {!rail && it.badge && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${badgeStyle[it.badge]}`}>{it.badge}</span>}
                </>
              );
              const cls = `flex h-10 items-center gap-3 rounded-[12px] text-[14px] font-medium transition-colors ${rail ? "justify-center" : "px-3"}`;
              return it.href ? (
                <Link key={it.label} href={it.href} title={rail ? it.label : undefined} aria-current={active ? "page" : undefined}
                  className={`${cls} ${active ? "bg-white/[0.08] text-ink" : "text-ink-muted hover:bg-white/5 hover:text-ink"}`}>{content}</Link>
              ) : (
                <span key={it.label} title={rail ? `${it.label} (bientôt)` : undefined} aria-disabled className={`${cls} cursor-default text-ink-muted/60`}>{content}</span>
              );
            })}
          </div>
        ))}
      </nav>

      {!rail ? (
        <div className="glass flex flex-col gap-2 rounded-[18px] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">Crédits</span>
            <span className="font-mono text-[13px] tabular">0</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full w-0 iri-fill" /></div>
          <Link href="/tarifs" className="text-[13px] font-semibold text-lilas hover:underline">Voir les forfaits</Link>
        </div>
      ) : (
        <Link href="/tarifs" title="Crédits : 0" className="flex size-10 items-center justify-center self-center rounded-full font-mono text-[12px] text-ink-muted glass">0</Link>
      )}
    </aside>
  );
}
