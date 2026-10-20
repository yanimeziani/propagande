/** Home sections: our own clips grouped by format family (labels are format names, not view counts). */
export type ShowTile = { slug: string; label: string };
export type ShowSection = { id: string; title: string; sub: string; href: string; tiles: ShowTile[] };

export const tools = [
  { href: "/#formats", title: "Formats", body: "Des vidéos qui marchent déjà, expliquées plan par plan.", clip: "fumee", soon: false },
  { href: "/creer", title: "Créer", body: "Filme 3 plans avec ton téléphone. On monte pour toi.", clip: "tenues", soon: false },
  { href: "/propagande", title: "Propagande", body: "Une vidéo longue devient 10 clips verticaux, prêts à publier.", clip: "rap-foule", soon: false },
  { href: "/publier", title: "Publier", body: "Instagram, TikTok et YouTube, au bon moment.", clip: "notification", soon: true },
  { href: "/messages", title: "Messages", body: "Tes commentaires et tes DM deviennent des clients.", clip: "doigts", soon: true },
];

export const sections: ShowSection[] = [
  { id: "mode", title: "Mode & tendances", sub: "Transitions, tenues, danse : les formats qui font des millions de vues.", href: "/creer", tiles: [
    { slug: "fumee", label: "Transition fumée" }, { slug: "rap-foule", label: "Rap de foule" }, { slug: "eclaboussure", label: "Éclaboussure" },
    { slug: "fenetre-auto", label: "Fenêtre d'auto" }, { slug: "tenues", label: "Tenues de la semaine" }, { slug: "danse", label: "Danse libre" }, { slug: "contre-plongee", label: "Contre-plongée" } ] },
  { id: "cinema", title: "Cinéma", sub: "Des plans de film pour ton quotidien : lumière, macro, émotion.", href: "/creer", tiles: [
    { slug: "anime", label: "Générique anime" }, { slug: "montreal-street", label: "Montréal, heure dorée" }, { slug: "desk-macro", label: "Macro" },
    { slug: "agents", label: "Agents IA" }, { slug: "regard", label: "Micro-émotion" }, { slug: "bureau", label: "Bureau" }, { slug: "heure-doree", label: "Heure dorée" } ] },
  { id: "motion", title: "Motion design", sub: "Texte qui frappe, 3D, particules : du rythme dès la première seconde.", href: "/creer", tiles: [
    { slug: "particules", label: "Particules" }, { slug: "profondeur", label: "3D" }, { slug: "type", label: "Texte qui frappe" },
    { slug: "fluide", label: "Fluide" }, { slug: "systemes", label: "Grille" }, { slug: "forme", label: "Formes" }, { slug: "vitesse", label: "Vitesse" } ] },
  { id: "quotidien", title: "Produit & quotidien", sub: "Ton café, ton salon, ton commerce : filmés comme une pub.", href: "/creer", tiles: [
    { slug: "tasse", label: "Produit" }, { slug: "snack-nuit", label: "Snack de nuit" }, { slug: "scroll-salon", label: "Scroll" },
    { slug: "ton-chalet", label: "Crochet en 1 seconde" }, { slug: "chalet-16x9", label: "Avant / après" }, { slug: "la-lumiere", label: "Lumière" }, { slug: "en-francais", label: "En français" } ] },
];
