import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { PageScroll } from "@/components/page-scroll";
import { Scene } from "@/components/scene";
import { VolumeSlider } from "@/components/volume-slider";
import { AudioProvider } from "@/lib/audio";
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

        {/* Edge-blur overlay. A fixed full-viewport div with
            backdrop-filter:blur masked by a radial gradient so only
            the periphery is blurred. backdrop-filter reads from the
            compositor — works on canvas AND DOM, giving the whole
            app a unified lens-defocus edge effect. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            // Above main content (z:10) so it can blur the text too,
            // below the nav (z:40) and volume slider so controls
            // stay sharp + clickable.
            zIndex: 30,
            backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)",
            // Mask: transparent at center, opaque at edges → blur
            // only renders where the mask is opaque. Gradient stops
            // chosen so the inner ~50% of the frame stays sharp and
            // the outer ~25% is fully blurred, with a smooth fade.
            maskImage:
              "radial-gradient(ellipse 85% 80% at center, transparent 35%, rgba(0,0,0,0.4) 65%, black 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 85% 80% at center, transparent 35%, rgba(0,0,0,0.4) 65%, black 100%)",
          }}
        />
        <AudioProvider>
          <ScrollProvider>
            <Scene />
            <VolumeSlider />
            <PageScroll>{children}</PageScroll>
          </ScrollProvider>
        </AudioProvider>
      </body>
    </html>
  );
}
