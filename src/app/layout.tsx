import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Island } from "@/components/island";
import { ConsolePanel } from "@/components/console/console-panel";
import { KnobRail } from "@/components/console/knob-rail";
import { LeftRail } from "@/components/console/left-rail";
import { PageScroll } from "@/components/page-scroll";
import { Scene } from "@/components/scene";
import { AudioProvider } from "@/lib/audio";
import { LanguageProvider } from "@/lib/language-context";
import { ScrollProvider } from "@/lib/scroll-context";
import { ThemeProvider } from "@/lib/theme-context";
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
      suppressHydrationWarning
      className={`${geist.variable} ${fraunces.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Set the theme class before first paint so there's no dark→light
            flash on a reload when the user previously chose light. Mirrors
            the no-flash script the other Pluto sites use. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sk-theme');if(t==='light')document.documentElement.classList.add('light')}catch(e){}`,
          }}
        />
      </head>
      {/* overflow-hidden because actual page scroll happens inside the
          PageScroll ScrollArea below. Without this, native scrollbars
          can still appear if children overflow the body. */}
      <body className="text-ink antialiased overflow-hidden h-svh bg-canvas">
        {/* SVG filter for DOM chromatic aberration. Splits RGB into
            three channels, offsets each by 1-2px in opposing
            directions, composites with screen blending. Same effect
            family as the WebGL CA post-pass so the entire scene
            (canvas + DOM type) reads as one coherent visual layer. */}
        <svg
          aria-hidden
          width="0"
          height="0"
          style={{ position: "absolute", pointerEvents: "none" }}
        >
          <defs>
            <filter id="ca" x="-5%" y="-5%" width="110%" height="110%">
              {/* Red channel — shifted left/up */}
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="red"
              />
              <feOffset in="red" dx="-0.6" dy="0" result="redShift" />
              {/* Green channel — stays centered */}
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="green"
              />
              {/* Blue channel — shifted right/down */}
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="blue"
              />
              <feOffset in="blue" dx="0.6" dy="0" result="blueShift" />
              {/* Composite via 'screen' so the offset channels
                  recombine into the original color where they
                  overlap, with visible RGB fringe at edges. */}
              <feBlend in="redShift" in2="green" mode="screen" result="rg" />
              <feBlend in="rg" in2="blueShift" mode="screen" />
            </filter>
          </defs>
        </svg>

        <ThemeProvider>
          <AudioProvider>
          <LanguageProvider>
          <ScrollProvider>
            {/* The console. A 3-column row: audio INPUT rail · the
                screen (island) · the section-knob rail. The rails are
                real columns (~5% each) that FRAME the screen — they
                replace the left/right bezel rather than floating over
                it. The island fills the ~90% center track. A thin
                top/bottom gutter on the island keeps the screen inset.

                Below lg the rails collapse (bezel too thin for hardware)
                and ConsolePanel takes over as a horizontal control deck
                pinned below the content. */}
            <div className="flex h-svh w-full items-stretch">
              <LeftRail />
              <Island>
                <Scene />
                <PageScroll>{children}</PageScroll>
              </Island>
              <KnobRail />
            </div>
            <ConsolePanel />
          </ScrollProvider>
          </LanguageProvider>
          </AudioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
