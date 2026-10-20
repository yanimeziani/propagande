"use client";
import { useEffect, useRef } from "react";

/** Muted loop that only plays while on screen, so a long page doesn't decode dozens of videos at once. */
export function LazyVideo({ slug, className = "" }: { slug: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { rootMargin: "120px" }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} className={className} src={`/wall/${slug}.mp4`} poster={`/wall/${slug}.jpg`} muted loop playsInline preload="none" aria-hidden />;
}
