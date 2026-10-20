import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["700", "800"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "MadeLucid · Trouve ton format. Filme. Publie.", template: "%s · MadeLucid" },
  description: "Des formats vidéo qui marchent, filmés avec ton téléphone, montés pour toi, publiés au bon moment.",
};

export const viewport: Viewport = { themeColor: "#07060b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA">
      <body className={`${bricolage.variable} ${figtree.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
