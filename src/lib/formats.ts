export type Format = {
  slug: string;
  title: string;
  hook: string;
  seconds: number;
  shots: number;
  level: "Facile" | "Moyen" | "Avancé";
  cover?: string;
  glow: "corail" | "rose" | "violet";
  trending?: boolean;
  steps: { shot: string; seconds: number }[];
};

/** Example formats (marked as examples in the UI until the real library is filled). */
export const formats: Format[] = [
  { slug: "avant-apres", title: "Avant / après en 3 plans", hook: "Montre le résultat dans la première seconde.", seconds: 25, shots: 3, level: "Facile", cover: "/formats/chalet.jpg", glow: "violet", trending: true,
    steps: [{ shot: "Le plan large, tel quel", seconds: 3 }, { shot: "Le même plan, éclairé et monté", seconds: 3 }, { shot: "Toi qui dis le prix", seconds: 6 }] },
  { slug: "trois-plans", title: "3 plans à filmer ce soir", hook: "Un conseil par plan, rien de plus.", seconds: 30, shots: 3, level: "Facile", cover: "/formats/cafe.jpg", glow: "corail",
    steps: [{ shot: "L'arrivée, en marchant", seconds: 8 }, { shot: "Un détail, de très près", seconds: 5 }, { shot: "La vue, deux fois plus lent", seconds: 8 }] },
  { slug: "jour-1", title: "Jour 1 d'un défi", hook: "Dis le chiffre que tu vises, devant tout le monde.", seconds: 45, shots: 4, level: "Moyen", cover: "/formats/montreal.jpg", glow: "rose", trending: true,
    steps: [{ shot: "Toi, face caméra : le défi", seconds: 8 }, { shot: "Ton point de départ en chiffres", seconds: 6 }, { shot: "Ce que tu fais aujourd'hui", seconds: 15 }, { shot: "Rendez-vous demain", seconds: 4 }] },
  { slug: "prix-a-la-fin", title: "Le prix à la fin", hook: "Le travail d'abord, le prix en dernier.", seconds: 20, shots: 4, level: "Facile", glow: "violet",
    steps: [{ shot: "Le problème, en une image", seconds: 3 }, { shot: "Tes mains au travail", seconds: 6 }, { shot: "Le résultat", seconds: 4 }, { shot: "Le prix, écrit à l'écran", seconds: 3 }] },
  { slug: "coulisses", title: "Les coulisses du matin", hook: "Ce que personne ne voit avant d'ouvrir.", seconds: 30, shots: 5, level: "Moyen", glow: "corail",
    steps: [{ shot: "La porte qui s'ouvre", seconds: 3 }, { shot: "Le café", seconds: 4 }, { shot: "La préparation", seconds: 10 }, { shot: "Le premier client", seconds: 5 }, { shot: "Ton sourire", seconds: 2 }] },
  { slug: "question-reponse", title: "Une question, une réponse", hook: "Lis un vrai commentaire à voix haute.", seconds: 35, shots: 2, level: "Facile", glow: "rose",
    steps: [{ shot: "Le commentaire à l'écran", seconds: 3 }, { shot: "Toi qui réponds, face caméra", seconds: 30 }] },
];
