import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
const styles: Record<Variant, string> = {
  primary: "bg-corail text-on-corail hover:brightness-110 shadow-[0_8px_30px_-8px_var(--corail)]",
  secondary: "glass text-ink hover:bg-white/10",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
};
const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-[filter,background-color,color] duration-200 ease-out whitespace-nowrap";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", href, children }: { variant?: Variant; className?: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}
