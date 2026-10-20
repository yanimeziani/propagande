import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Installable on a phone or a computer: it then opens like an app and works offline
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Propagande · MadeLucid",
    short_name: "Propagande",
    description: "Ta vidéo longue, 8 clips prêts à publier. Sur ton appareil, même sans internet.",
    start_url: "/propagande/",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#0f0f0f",
    lang: "fr-CA",
    icons: [{ src: "/icon.png", sizes: "256x256", type: "image/png" }],
  };
}
