import type { ReactNode } from "react";

export const metadata = { title: "Reverse Recruiting Assistant" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
