import type { Metadata } from "next";
import { CONTACT } from "@/lib/offer";

export const metadata: Metadata = { title: "Confidentialité", description: "Tes vidéos ne quittent jamais ton appareil. Ce que le site voit, et ce qu'il ne voit pas." };

const blocks: { h: string; p: string[] }[] = [
  {
    h: "Tes vidéos ne quittent pas ton appareil",
    p: [
      "Propagande lit ta vidéo dans ton navigateur. L'écoute, la transcription, le choix des moments et l'export se font sur ton ordinateur ou ton téléphone. Ta vidéo n'est jamais envoyée à MadeLucid ni à personne d'autre.",
      "Tes clips et tes transcriptions sont gardés dans le stockage de ton navigateur, sur cet appareil seulement. Tu peux les effacer dans « Mes créations », ou en effaçant les données du site dans ton navigateur.",
    ],
  },
  {
    h: "Ce qui est téléchargé, et d'où",
    p: [
      "La première fois, ton navigateur télécharge le modèle de voix (Whisper, licence MIT) depuis Hugging Face (huggingface.co), et le moteur qui le fait tourner (ONNX Runtime) depuis jsDelivr (cdn.jsdelivr.net). Comme pour n'importe quel téléchargement, ces services voient ton adresse IP. Ils ne voient pas ta vidéo.",
    ],
  },
  {
    h: "Ce que le site garde",
    p: [
      "Pas de compte, pas de témoins (cookies) publicitaires, pas d'outil de statistiques tiers.",
      "Pour savoir si l'outil sert, la page compte quelques événements anonymes (par exemple « un clip a été exporté ») en demandant un petit fichier à notre serveur. Aucun identifiant, rien sur toi ni sur ta vidéo. Pour reconnaître un retour la deuxième semaine, la date de ton premier clip reste dans ton navigateur et n'est jamais envoyée.",
      "Le serveur qui héberge le site garde des journaux techniques (adresse IP, page demandée, heure) pour la sécurité, comme tous les sites web.",
    ],
  },
  {
    h: "Responsable et contact",
    p: [`Yani Meziani est responsable de la protection des renseignements personnels chez MadeLucid. Pour toute question ou demande : ${CONTACT}.`],
  },
];

export default function Page() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-16 md:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-[52px]">Confidentialité</h1>
        <p className="text-[18px] text-ink-muted">En une phrase : ta vidéo reste chez toi.</p>
      </header>
      {blocks.map((b) => (
        <section key={b.h} className="flex flex-col gap-3">
          <h2 className="text-[22px] font-extrabold">{b.h}</h2>
          {b.p.map((t) => <p key={t} className="text-[16px] leading-relaxed text-ink/90">{t}</p>)}
        </section>
      ))}
      <p className="text-[13px] text-ink-muted">Mise à jour : 20 octobre 2026.</p>
    </article>
  );
}
