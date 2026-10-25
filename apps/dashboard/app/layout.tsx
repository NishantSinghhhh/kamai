import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kamai",
  description: "The agent that pays its own bills — live P&L, jobs and policy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
