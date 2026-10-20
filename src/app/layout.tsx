import type { Metadata, Viewport } from "next";
import { Big_Shoulders_Stencil, Geist, Geist_Mono, Special_Elite } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });
// One face per tool name: a stencil for Propagande, a typewriter for Agent double
const stencil = Big_Shoulders_Stencil({ variable: "--font-stencil-src", subsets: ["latin"], weight: ["800", "900"], adjustFontFallback: false, fallback: ["Impact", "Arial Narrow", "sans-serif"] });
const typewriter = Special_Elite({ variable: "--font-typewriter-src", subsets: ["latin"], weight: "400", fallback: ["Courier New", "monospace"] });

export const metadata: Metadata = {
  title: { default: "MadeLucid · Propagande et Agent double", template: "%s · MadeLucid" },
  description: "Propagande transforme une vidéo longue en clips qui tournent. Agent double change le personnage de ta scène.",
};

export const viewport: Viewport = { themeColor: "#0f0f0f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA">
      <body className={`${geist.variable} ${geistMono.variable} ${stencil.variable} ${typewriter.variable}`}>{children}</body>
    </html>
  );
}
