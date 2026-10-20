import { BottomTabs } from "@/components/site/bottom-tabs";
import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
      <BottomTabs />
    </div>
  );
}
