export type NavItem = { href: string; label: string; match: (p: string) => boolean };

/** The two tools (also the mobile bottom tabs), then Tarifs on desktop. */
export const sections: NavItem[] = [
  { href: "/propagande", label: "Propagande", match: (p) => p.startsWith("/propagande") },
  { href: "/agent-double", label: "Agent double", match: (p) => p.startsWith("/agent-double") },
];
export const extra: NavItem[] = [{ href: "/tarifs", label: "Tarifs", match: (p) => p.startsWith("/tarifs") }];
