import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unibox",
  description: "Unified social inbox for Messenger, Instagram, WhatsApp, and LINE"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The inbox is a long-session tool, so it ships dark by default.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
