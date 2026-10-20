"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DownloadSimple, HardDrives, Play, Trash } from "@phosphor-icons/react";
import { ToolName } from "@/components/brand/tool-name";
import { fmtTime } from "@/lib/clips/analyze";
import { deleteCreation, fmtBytes, fmtWhen, getBlob, storageUsed, type Creation, type Tool } from "@/lib/library";
import { downloadCreation } from "./actions";
import { useCreations } from "./use-creations";

type Filter = Tool | "tous";
const tabs: [Filter, string][] = [["tous", "Tout"], ["propagande", "Propagande"], ["agent-double", "Agent double"]];

/** « Mes créations »: everything exported, on this device. */
export function CreationsView({ initialTool }: { initialTool: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialTool);
  const all = useCreations();
  const items = all?.filter((c) => filter === "tous" || c.tool === filter) ?? null;
  const [space, setSpace] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => { storageUsed().then(setSpace).catch(() => {}); }, [all]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] uppercase md:text-[52px]">Mes créations</h1>
          <p className="flex items-center gap-2 text-[15px] text-ink-muted">
            <HardDrives size={18} aria-hidden /> Gardées sur cet appareil{space ? ` · ${fmtBytes(space.used)} utilisés` : ""}. Rien n&apos;est envoyé.
          </p>
        </div>
        <div className="glass flex gap-1 rounded-full p-1" role="tablist" aria-label="Filtrer par outil">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`h-9 rounded-full px-4 text-[14px] font-semibold ${filter === k ? "bg-violet text-on-violet" : "text-ink-muted hover:text-ink"}`}>
              {label}{all && k !== "tous" ? <span className="ml-1.5 font-mono text-[12px] opacity-75">{all.filter((c) => c.tool === k).length}</span> : null}
            </button>
          ))}
        </div>
      </header>

      {items === null && <p className="text-ink-muted">Chargement…</p>}
      {items?.length === 0 && (
        <div className="glass light-edge flex flex-col items-start gap-4 rounded-[28px] p-8">
          <p className="font-display text-[24px] font-bold">Rien ici pour l&apos;instant.</p>
          <p className="max-w-[48ch] text-[16px] text-ink-muted">Dépose une vidéo longue dans Propagande : chaque clip que tu exportes atterrit ici, prêt à télécharger.</p>
          <Link href="/propagande" className="inline-flex h-11 items-center rounded-full bg-corail px-5 font-semibold text-on-corail">Ouvrir Propagande</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
        {items?.map((c) => <Card key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function Card({ c }: { c: Creation }) {
  const [src, setSrc] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  async function play() {
    if (src) return;
    const b = await getBlob(c.id);
    if (b) setSrc(URL.createObjectURL(b));
  }
  return (
    <article className="glass flex flex-col gap-2 rounded-[22px] p-2">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[16px] bg-surface-200">
        {src ? (
          <video src={src} controls autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <button type="button" onClick={play} aria-label={`Lire ${c.title}`} className="group absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.thumb && <img src={c.thumb} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
            <span className="absolute inset-0 flex items-center justify-center"><span className="glass flex size-12 items-center justify-center rounded-full"><Play size={22} weight="fill" aria-hidden /></span></span>
          </button>
        )}
        <span className="glass absolute top-2 left-2 rounded-full px-2.5 py-1 font-mono text-[11.5px] tabular">{fmtTime(c.end - c.start)}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-1">
        <ToolName tool={c.tool} className="text-[14px] text-ink-muted" />
        <p className="truncate text-[14px] font-semibold">{c.title}</p>
        <p className="font-mono text-[12px] text-ink-muted tabular">{fmtWhen(c.createdAt)} · {fmtBytes(c.size)}</p>
      </div>
      <div className="flex items-center gap-1 px-1 pb-1">
        <button type="button" onClick={() => downloadCreation(c.id, `${c.title}.${c.ext}`)} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] font-semibold text-surface-100">
          <DownloadSimple size={16} aria-hidden /> Télécharger
        </button>
        {confirm ? (
          <button type="button" onClick={() => deleteCreation(c.id)} className="h-9 rounded-full bg-rec px-3 text-[13px] font-semibold text-on-rec">Supprimer ?</button>
        ) : (
          <button type="button" aria-label="Supprimer" onClick={() => setConfirm(true)} className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/10 hover:text-rec"><Trash size={18} aria-hidden /></button>
        )}
      </div>
    </article>
  );
}
