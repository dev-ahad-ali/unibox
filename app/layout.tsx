import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Lora, Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono" });

export const metadata: Metadata = {
  title: "Unibox",
  description: "Unified social inbox for Messenger, Instagram, WhatsApp, LINE, and Telegram"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The inbox is a long-session tool, so it ships dark by default.
  return (
    <html
      lang="en"
      className={`dark ${jakarta.variable} ${lora.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
