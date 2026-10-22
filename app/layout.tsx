import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GatherWise — Constraint-Aware Event Planning Copilot",
  description: "Turn natural-language event ideas into structured, actionable, and grounded event plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased selection:bg-brand-100 selection:text-brand-700">
        {children}
      </body>
    </html>
  );
}
