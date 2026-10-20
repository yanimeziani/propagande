/** The offer, in one place. Council verdict 2026-10-20 (ref/roast-room/sessions/2026-10-20-propagande-launch):
 *  the on-device clipper is free forever, written narrowly; Pro is named and priced on the site at launch.
 *  PRO_PRICE stays null until Yani sets it; the Tarifs page then says so plainly instead of inventing a number. */

export const CONTACT = "bonjour@madelucid.com";

/** What « gratuit, pour toujours » covers. Approved by Yani on 2026-10-20. A one-way door: never take any of it back. */
export const FREE_FOREVER = [
  "Le coupeur Propagande qui tourne sur ton appareil",
  "Les moments choisis, coupés au bout de la phrase",
  "Les trois ouvertures : tel quel, punch d'abord, question d'abord",
  "Les sous-titres mot à mot et l'export 9:16",
  "Autant de vidéos que tu veux, une à la fois",
] as const;

/** Public line: promises the list above and nothing wider (council, Bezos readiness check). The internal guide
 *  « what costs us nothing stays free » stays out of public copy: Pro features can run on the device too. */
export const FREE_SCOPE_NOTE = "Tout ce qui est dans la colonne Gratuit le reste, pour toujours. On ne retire jamais rien.";

export const PRO = {
  name: "Pro",
  // Accepted by Yani with the 29 $ price on 2026-10-20 (docs/LAUNCH.md 1b)
  features: [
    "File d'attente : dépose 10 vidéos d'un coup",
    "Styles de sous-titres sauvegardés pour chaque campagne",
    "Chaque semaine, Yani revoit tes 3 meilleurs clips et te dit quoi changer",
    "Premier mois remboursé, sans question",
  ],
} as const;

/** Pro includes Yani's weekly review (about 10 min a member), so seats are capped to fit his 20-hour week
 *  (Hormozi, readiness check): 15 members is about 2.5 h a week. Yani can change it. */
export const PRO_SEATS = 15;

/** Set by Yani on 2026-10-20 (council condition 3). Also in brand/offers.md. */
export const PRO_PRICE: string | null = "29 $ / mois";
