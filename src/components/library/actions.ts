import { getBlob } from "@/lib/library";

/** Download a saved creation from this browser's library. */
export async function downloadCreation(id: string, filename: string) {
  const blob = await getBlob(id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
