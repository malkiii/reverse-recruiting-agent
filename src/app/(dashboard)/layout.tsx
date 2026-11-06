import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { SidePanelOffset, SidePanelProvider } from "@/components/side-panel";
import { isDarkTheme } from "@/lib/theme";
import { SIDE_PANEL_COOKIE } from "@/lib/ui-cookies";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const panelOpen = (await cookies()).get(SIDE_PANEL_COOKIE)?.value !== "closed";

  return (
    <SidePanelProvider initialOpen={panelOpen}>
      <Nav dark={await isDarkTheme()} />
      <SidePanelOffset className="md:pl-56">
        <main className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </SidePanelOffset>
    </SidePanelProvider>
  );
}
