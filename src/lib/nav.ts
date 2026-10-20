export type NavItem = { href: string; label: string; match: (p: string) => boolean };

/** The four app sections (also the mobile bottom tabs), then Tarifs on desktop. */
export const sections: NavItem[] = [
  { href: "/", label: "Formats", match: (p) => p === "/" },
  { href: "/creer", label: "Créer", match: (p) => p.startsWith("/creer") },
  { href: "/publier", label: "Publier", match: (p) => p.startsWith("/publier") },
  { href: "/messages", label: "Messages", match: (p) => p.startsWith("/messages") },
];
export const extra: NavItem[] = [{ href: "/tarifs", label: "Tarifs", match: (p) => p.startsWith("/tarifs") }];
