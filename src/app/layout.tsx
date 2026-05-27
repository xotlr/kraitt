import type { Metadata } from "next";
import { Fraunces, Geist_Mono } from "next/font/google";
import { Scene } from "@/components/scene";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sufian Kraitt — Audio Engineer / Filmton / Musikproduktion",
  description:
    "Audio Engineer für Film, TV und Musikproduktion. Setton, Audiopostproduktion, Mixing, Mastering, Sprachbearbeitung.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${fraunces.variable} ${geistMono.variable}`}>
      <body className="text-ink antialiased atmos overflow-x-hidden">
        <Scene />
        {children}
      </body>
    </html>
  );
}
