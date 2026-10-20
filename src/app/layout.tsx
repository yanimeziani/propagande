import type { Metadata, Viewport } from "next";
import { Big_Shoulders_Stencil, Geist, Geist_Mono, Special_Elite } from "next/font/google";
import { Offline } from "@/components/site/offline";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });
// One face per tool name: a stencil for Propagande, a typewriter for Agent double
const stencil = Big_Shoulders_Stencil({ variable: "--font-stencil-src", subsets: ["latin"], weight: ["800", "900"], adjustFontFallback: false, fallback: ["Impact", "Arial Narrow", "sans-serif"] });
const typewriter = Special_Elite({ variable: "--font-typewriter-src", subsets: ["latin"], weight: "400", fallback: ["Courier New", "monospace"] });

export const metadata: Metadata = {
  title: { default: "Propagande · Ta vidéo longue, 8 clips prêts à publier", template: "%s · MadeLucid" },
  description: "Dépose une vidéo longue, reçois 8 clips verticaux sous-titrés. Tout se passe sur ton appareil, rien n'est envoyé. Le coupeur est gratuit, pour toujours.",
};

export const viewport: Viewport = { themeColor: "#0f0f0f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA">
      <body className={`${geist.variable} ${geistMono.variable} ${stencil.variable} ${typewriter.variable}`}>{children}<Offline /></body>
    </html>
  );
}
