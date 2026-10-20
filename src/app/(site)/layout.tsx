import { Sidebar } from "@/components/shell/sidebar";
import { BottomTabs } from "@/components/site/bottom-tabs";
import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </div>
      <BottomTabs />
    </div>
  );
}
