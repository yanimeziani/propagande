import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5 px-4 pt-16 md:px-6">
      <span className="font-mono text-[13px] tracking-[0.08em] text-ink-muted uppercase">Bientôt</span>
      <h1 className="font-display text-[44px] leading-[1] font-extrabold tracking-[-0.02em] md:text-[56px]">Messages</h1>
      <p className="glass light-edge max-w-[52ch] rounded-[24px] p-6 text-[18px] leading-[1.5] text-ink-muted">Les commentaires et les DM de toutes tes vidéos au même endroit, avec une réponse prête en français.</p>
      <ButtonLink href="/creer">Créer une vidéo</ButtonLink>
    </div>
  );
}
