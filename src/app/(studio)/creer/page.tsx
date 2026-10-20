import type { Metadata } from "next";
import { StudioView } from "@/components/studio/studio-view";
import { formats } from "@/lib/formats";

export const metadata: Metadata = { title: "Créer" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ format?: string; idee?: string }> }) {
  const { format, idee } = await searchParams;
  const initial = formats.find((f) => f.slug === format) ?? formats[0];
  return <StudioView initialSlug={initial.slug} idea={idee?.slice(0, 280)} />;
}
