import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT } from "@/lib/offer";

export const metadata: Metadata = { title: "Aide", description: "Les questions qu'on nous pose sur Propagande : prix, appareils, langues, confidentialité." };

const faq: { q: string; a: React.ReactNode }[] = [
  { q: "C'est vraiment gratuit ?", a: <>Oui. Le coupeur tourne sur ton appareil, donc chaque clip ne nous coûte rien, et il reste gratuit pour toujours. Le détail est sur la page <Link href="/tarifs" className="text-lilas underline">Tarifs</Link>.</> },
  { q: "Pourquoi télécharger 566 Mo la première fois ?", a: "C'est le modèle de voix (Whisper) qui transcrit ta vidéo sur ton appareil. Il se télécharge une seule fois, puis il reste dans ton navigateur. Le site te demande avant de commencer. Sur données mobiles, attends le Wi-Fi." },
  { q: "Est-ce que mon ordi va être capable ?", a: "Le site vérifie ton appareil avant le téléchargement. Avec Chrome ou Edge à jour sur un ordinateur, c'est rapide : sur un Mac récent, 6 minutes de vidéo sont transcrites en environ 1 min 30. Sans accès à la carte graphique, ça marche avec un modèle plus petit, mais beaucoup plus lentement. Tu peux toujours continuer sans sous-titres." },
  { q: "Ça marche dans quelles langues ?", a: "Propagande détecte la langue tout seul : français (québécois compris), anglais et environ 90 autres langues." },
  { q: "Ça marche sans internet ?", a: "Oui, après la première fois. La première visite télécharge le modèle de voix (566 Mo). Ensuite, Propagande s'ouvre et coupe tes vidéos même en mode avion : il n'y a pas de serveur derrière. Sur un téléphone ou un ordi, tu peux aussi l'installer comme une app depuis ton navigateur." },
  { q: "Ma vidéo est-elle envoyée quelque part ?", a: <>Non. Elle ne quitte jamais ton appareil. Voir <Link href="/confidentialite" className="text-lilas underline">Confidentialité</Link>.</> },
  { q: "Une vidéo de combien de temps ?", a: "On l'a testé jusqu'à 30 minutes : sur un Mac récent, environ 7 minutes du dépôt aux 8 clips. Plus long devrait passer, mais on ne l'a pas encore vérifié pour une heure complète. Si ça bloque, écris-nous." },
  { q: "C'est quoi « Fait avec Propagande » à la fin ?", a: "Une signature de 1,4 seconde à la fin de chaque clip. Tu peux l'enlever d'un clic dans Réglages." },
  { q: "Où sont mes clips ?", a: <>Dans <Link href="/creations" className="text-lilas underline">Mes créations</Link>, sur cet appareil. Si tu effaces les données du site dans ton navigateur, ils disparaissent : télécharge ceux que tu veux garder.</> },
  { q: "Ça ne marche pas. Je fais quoi ?", a: `Écris à ${CONTACT} avec ton navigateur, ton appareil et ce que tu voyais à l'écran. Une capture d'écran aide beaucoup.` },
];

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-16 md:px-6">
      <h1 className="font-display text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-[52px]">Aide</h1>
      <div className="flex flex-col gap-3">
        {faq.map((f) => (
          <details key={f.q} className="glass group rounded-[20px] p-5 open:pb-6">
            <summary className="cursor-pointer list-none text-[18px] font-bold marker:hidden">{f.q}</summary>
            <p className="mt-3 text-[16px] leading-relaxed text-ink/90">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
