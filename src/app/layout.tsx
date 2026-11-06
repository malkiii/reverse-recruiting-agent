import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { isDarkTheme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = { title: "Reverse Recruiting Assistant" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={(await isDarkTheme()) ? "dark" : undefined}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
