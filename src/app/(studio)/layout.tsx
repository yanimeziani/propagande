import { Sidebar } from "@/components/shell/sidebar";
import { BottomTabs } from "@/components/site/bottom-tabs";
import { TopNav } from "@/components/site/top-nav";

/** Tool pages: the sidebar, a compact bar and a full-height workspace (no footer). */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh md:h-dvh md:overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav compact />
        <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
