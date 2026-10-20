import { BottomTabs } from "@/components/site/bottom-tabs";
import { TopNav } from "@/components/site/top-nav";

/** Studio pages: compact nav and a full-height workspace (no footer, no page scroll on desktop). */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:overflow-hidden">
      <TopNav compact />
      <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>
      <BottomTabs />
    </div>
  );
}
