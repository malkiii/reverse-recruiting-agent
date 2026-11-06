import type { ReactNode } from "react";
import { Nav } from "@/components/nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <div className="md:pl-60">
        <main className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>
    </>
  );
}
