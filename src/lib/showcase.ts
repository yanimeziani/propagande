/** Home sections: our own clips grouped by format family (labels are format names, not view counts). */
export type ShowTile = { slug: string; label: string };
export type ShowSection = { id: string; title: string; sub: string; href: string; tiles: ShowTile[] };

export const sections: ShowSection[] = [
  { id: "mode", title: "Mode & tendances", sub: "Transitions, tenues, danse : les formats qui font des millions de vues.", href: "/propagande", tiles: [
    { slug: "fumee", label: "Transition fumée" }, { slug: "rap-foule", label: "Rap de foule" }, { slug: "eclaboussure", label: "Éclaboussure" },
    { slug: "fenetre-auto", label: "Fenêtre d'auto" }, { slug: "tenues", label: "Tenues de la semaine" }, { slug: "danse", label: "Danse libre" }, { slug: "contre-plongee", label: "Contre-plongée" } ] },
  { id: "cinema", title: "Cinéma", sub: "Des plans de film pour ton quotidien : lumière, macro, émotion.", href: "/propagande", tiles: [
    { slug: "anime", label: "Générique anime" }, { slug: "montreal-street", label: "Montréal, heure dorée" }, { slug: "desk-macro", label: "Macro" },
    { slug: "agents", label: "Agents IA" }, { slug: "regard", label: "Micro-émotion" }, { slug: "bureau", label: "Bureau" }, { slug: "heure-doree", label: "Heure dorée" } ] },
  { id: "motion", title: "Motion design", sub: "Texte qui frappe, 3D, particules : du rythme dès la première seconde.", href: "/propagande", tiles: [
    { slug: "particules", label: "Particules" }, { slug: "profondeur", label: "3D" }, { slug: "type", label: "Texte qui frappe" },
    { slug: "fluide", label: "Fluide" }, { slug: "systemes", label: "Grille" }, { slug: "forme", label: "Formes" }, { slug: "vitesse", label: "Vitesse" } ] },
  { id: "quotidien", title: "Produit & quotidien", sub: "Ton café, ton salon, ton commerce : filmés comme une pub.", href: "/propagande", tiles: [
    { slug: "tasse", label: "Produit" }, { slug: "snack-nuit", label: "Snack de nuit" }, { slug: "scroll-salon", label: "Scroll" },
    { slug: "ton-chalet", label: "Crochet en 1 seconde" }, { slug: "chalet-16x9", label: "Avant / après" }, { slug: "la-lumiere", label: "Lumière" }, { slug: "en-francais", label: "En français" } ] },
];
