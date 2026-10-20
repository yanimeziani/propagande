import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="mx-auto mt-24 flex w-full max-w-6xl flex-col gap-6 border-t border-glass-rim px-4 pt-10 pb-32 md:flex-row md:items-center md:justify-between md:px-6 md:pb-12">
      <Logo compact />
      <p className="text-sm text-ink-muted">Fait au Québec. Code ouvert (AGPL). © {new Date().getFullYear()} MadeLucid</p>
    </footer>
  );
}
