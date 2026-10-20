"use client";
import { useEffect, useState } from "react";
import { listCreations, onLibraryChange, type Creation, type Tool } from "@/lib/library";

/** Live list of saved creations (null while loading). Re-reads when anything is saved or deleted. */
export function useCreations(tool?: Tool): Creation[] | null {
  const [items, setItems] = useState<Creation[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => listCreations(tool).then((x) => live && setItems(x)).catch(() => live && setItems([]));
    load();
    const off = onLibraryChange(load);
    return () => { live = false; off(); };
  }, [tool]);
  return items;
}
