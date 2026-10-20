"use client";
import Link from "next/link";
import { useState } from "react";
import { ClockCounterClockwise, DownloadSimple, Trash } from "@phosphor-icons/react";
import { fmtTime } from "@/lib/clips/analyze";
import { deleteCreation, fmtWhen, type Tool } from "@/lib/library";
import { downloadCreation } from "./actions";
import { useCreations } from "./use-creations";

const empty: Record<Tool, string> = {
  propagande: "Tes clips exportés apparaîtront ici, même après avoir fermé la page.",
  "agent-double": "Tes brouillons apparaîtront ici dès que le moteur sera en ligne.",
};

/** Right-hand history rail of a tool: every past export, kept on this device. */
export function HistoryPanel({ tool, className = "" }: { tool: Tool; className?: string }) {
  const items = useCreations(tool);
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <aside className={`glass flex min-w-0 flex-col gap-3 rounded-[24px] p-4 ${className}`} aria-labelledby={`hist-${tool}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`hist-${tool}`} className="flex items-center gap-2 text-[15px] font-semibold">
          <ClockCounterClockwise size={18} aria-hidden /> Historique
          {items && items.length > 0 && <span className="font-mono text-[12px] text-ink-muted tabular">{items.length}</span>}
        </h2>
        <Link href={`/creations?outil=${tool}`} className="text-[13px] font-semibold text-lilas hover:underline">Tout voir</Link>
      </div>
      {items === null && <p className="text-[14px] text-ink-muted">Chargement…</p>}
      {items?.length === 0 && <p className="rounded-[14px] border border-dashed border-glass-rim p-4 text-[14px] leading-snug text-ink-muted">{empty[tool]}</p>}
      <ul className="flex flex-col gap-2 overflow-y-auto">
        {items?.map((c) => (
          <li key={c.id} className="flex gap-3 rounded-[14px] p-2 hover:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.thumb ? <img src={c.thumb} alt="" className="h-20 w-[45px] shrink-0 rounded-[8px] object-cover" /> : <span className="h-20 w-[45px] shrink-0 rounded-[8px] bg-surface-200" />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-[14px] font-semibold">{c.title}</p>
              <p className="font-mono text-[12px] text-ink-muted tabular">{fmtTime(c.end - c.start)} · {fmtWhen(c.createdAt)}</p>
              <div className="mt-auto flex items-center gap-1">
                <button type="button" onClick={() => downloadCreation(c.id, `${c.title}.${c.ext}`)} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-ink-muted hover:bg-white/10 hover:text-ink">
                  <DownloadSimple size={16} aria-hidden /> Télécharger
                </button>
                {confirm === c.id ? (
                  <button type="button" onClick={() => { deleteCreation(c.id); setConfirm(null); }} className="h-8 rounded-full bg-rec px-2.5 text-[13px] font-semibold text-on-rec">Supprimer ?</button>
                ) : (
                  <button type="button" aria-label="Supprimer" onClick={() => setConfirm(c.id)} className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-white/10 hover:text-rec">
                    <Trash size={16} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
