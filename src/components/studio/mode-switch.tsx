import Link from "next/link";

/** Créer has two modes: start from a format, or cut a long video into clips (Propagande). */
export function ModeSwitch({ active }: { active: "format" | "propagande" }) {
  const item = (key: "format" | "propagande", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex h-9 items-center rounded-full px-4 text-[14px] font-semibold transition-colors ${active === key ? "bg-violet text-on-violet" : "text-ink-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="glass inline-flex w-fit gap-1 rounded-full p-1">
      {item("format", "/creer", "Format")}
      {item("propagande", "/propagande", "Propagande")}
    </div>
  );
}
