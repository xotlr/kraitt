import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { PageScroll } from "@/components/page-scroll";
import { Scene } from "@/components/scene";
import { ScrollProvider } from "@/lib/scroll-context";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["200", "300", "400", "500"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["italic"],
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
    <html
      lang="de"
      className={`${geist.variable} ${fraunces.variable} ${geistMono.variable}`}
    >
      {/* overflow-hidden because actual page scroll happens inside the
          PageScroll ScrollArea below. Without this, native scrollbars
          can still appear if children overflow the body. */}
      <body className="text-ink antialiased atmos overflow-hidden h-svh">
        <ScrollProvider>
          <Scene />
          <PageScroll>{children}</PageScroll>
        </ScrollProvider>
      </body>
    </html>
  );
}
