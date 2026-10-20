import { wallClips, type WallClip } from "@/lib/wall";

const fmt = new Intl.NumberFormat("fr-CA", { notation: "compact", maximumFractionDigits: 1 });

function Tile({ c }: { c: WallClip }) {
  return (
    <figure className="relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-glass-rim bg-surface-200">
      <video className="h-full w-full object-cover" src={`/wall/${c.slug}.mp4`} poster={`/wall/${c.slug}.jpg`} autoPlay muted loop playsInline preload="metadata" aria-hidden />
      <figcaption className="glass absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink">
        {c.label}
        {c.source && <span className="ml-1 font-mono text-ink-muted tabular">· {fmt.format(c.source.views)} vues</span>}
      </figcaption>
    </figure>
  );
}

/** Tilted 3D wall of clips; each column scrolls forever (content doubled, translated by half), alternating directions. */
export function HeroWall({ columns = 6 }: { columns?: number }) {
  const cols = Array.from({ length: columns }, (_, i) => {
    const items = Array.from({ length: 5 }, (_, k) => wallClips[(i + k * 6) % wallClips.length]);
    return { items, up: i % 2 === 0, dur: 38 + (i % 3) * 9 };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute top-1/2 left-1/2 grid h-[190%] w-[150%] gap-4 md:w-[130%]"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          transform: "translate(-50%, -50%) perspective(1600px) rotateX(32deg) rotateZ(-14deg) skewX(4deg)",
          transformOrigin: "center",
        }}
      >
        {cols.map((col, i) => (
          <div key={i} className="relative overflow-hidden">
            <div
              className={`wall-col flex flex-col gap-4 ${col.up ? "wall-col-up" : "wall-col-down"}`}
              style={{ ["--wall-dur" as string]: `${col.dur}s` }}
            >
              {[...col.items, ...col.items].map((c, k) => (
                <Tile key={k} c={c} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Vignette so the headline reads: dark centre band, fades at every edge */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 50% 50%, color-mix(in srgb, var(--surface-100) 92%, transparent) 0%, color-mix(in srgb, var(--surface-100) 60%, transparent) 55%, color-mix(in srgb, var(--surface-100) 15%, transparent) 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-surface-100 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-surface-100 to-transparent" />
    </div>
  );
}
