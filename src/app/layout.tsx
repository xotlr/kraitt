import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Island } from "@/components/island";
import { GrainOverlay } from "@/components/grain-overlay";
import { MobileConsole } from "@/components/console/mobile-console";
import { ConsoleHotkeys } from "@/components/console/console-hotkeys";
import { PostFx } from "@/components/post-fx";
import { KnobRail } from "@/components/console/knob-rail";
import { LeftRail } from "@/components/console/left-rail";
import { PageScroll } from "@/components/page-scroll";
import { Scene } from "@/components/scene";
import { AudioProvider } from "@/lib/audio";
import { LanguageProvider } from "@/lib/language-context";
import { ScrollProvider } from "@/lib/scroll-context";
import { ThemeProvider } from "@/lib/theme-context";
import "./globals.css";

// "Ghost mono": ONE typeface site-wide. Geist Mono carries everything —
// display, headings, body, accents — in the telemetry/instrument register
// (Apollo DSKY / Death Stranding HUD). The old Geist sans was dropped, so a
// single family is loaded. Weights 400/500 ONLY: the type weight ladder in
// globals.css must stay on these two cuts or the browser faux-thins/-bolds the
// mono, which reads cheap. The 300 cut was removed when the hero wordmark went
// from hairline to regular (a thin mono reads fashion, not engineered).
// Keep in sync with --weight-* there.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

// metadataBase resolves all relative URLs below (OG/icon paths, canonical) to
// absolute ones — required for OpenGraph + for Google to trust the canonical.
// The site's domain is sufiankraitt.com (see the contact email).
const SITE_URL = "https://sufiankraitt.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sufian Kraitt · Audio Engineer / Filmton / Musikproduktion",
    template: "%s · Sufian Kraitt",
  },
  description:
    "Audio Engineer für Film, TV und Musikproduktion. Setton, Audiopostproduktion, Mixing, Mastering, Sprachbearbeitung. Wien, AT.",
  applicationName: "Sufian Kraitt",
  authors: [{ name: "Sufian Kraitt" }],
  creator: "Sufian Kraitt",
  keywords: [
    "Sufian Kraitt",
    "Audio Engineer",
    "Tonmeister",
    "Filmton",
    "Setton",
    "Audiopostproduktion",
    "Mixing",
    "Mastering",
    "Musikproduktion",
    "Sound Recordist",
    "Wien",
  ],
  // Canonical — tells Google the one true URL for this page (kills duplicate-
  // content ambiguity from www/trailing-slash/query variants).
  alternates: {
    canonical: "/",
  },
  // The strongest honest "force Google" signal: explicitly allow full indexing
  // AND opt into large image + snippet previews, so Google shows the rich
  // result (favicon, title, description, OG image) rather than a bare link.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Icons — point Google + browsers at the branded marks (App Router also
  // auto-serves /icon.svg + /favicon.ico, but declaring them is explicit and
  // adds the apple-touch icon for iOS home-screen).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  // OpenGraph — the card shown when the site is shared (Slack, iMessage,
  // LinkedIn) and a ranking/relevance signal for search.
  openGraph: {
    type: "website",
    siteName: "Sufian Kraitt",
    title: "Sufian Kraitt · Audio Engineer / Filmton / Musikproduktion",
    description:
      "Audio Engineer für Film, TV und Musikproduktion. Setton, Audiopostproduktion, Mixing, Mastering.",
    url: SITE_URL,
    locale: "de_AT",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Sufian Kraitt — Audio Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sufian Kraitt · Audio Engineer",
    description: "Audio für Film, TV und Musikproduktion. Wien, AT.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={geistMono.variable}
    >
      <head>
        {/* Set the theme class before first paint so there's no dark→light
            flash on a reload when the user previously chose light. Mirrors
            the no-flash script the other Pluto sites use. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sk-theme');if(t==='light')document.documentElement.classList.add('light');var l=localStorage.getItem('sk-lang');if(l==='en')document.documentElement.lang='en'}catch(e){}`,
          }}
        />
        {/* JSON-LD structured data — the strongest signal for Google to render a
            branded/knowledge result for this person. Only verifiable facts; the
            `sameAs` profiles (Instagram @szumksufko, IMDb nm17906294) are the
            confirmed real ones — these are what let Google connect this site to
            his off-site identity for a knowledge result. No LinkedIn (none
            verified — a bogus sameAs is worse than none). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Sufian Kraitt",
              jobTitle: "Audio Engineer",
              description:
                "Audio Engineer für Film, TV und Musikproduktion — Setton, Audiopostproduktion, Mixing, Mastering.",
              url: "https://sufiankraitt.com",
              email: "mailto:hello@sufiankraitt.com",
              image: "https://sufiankraitt.com/og.png",
              sameAs: [
                "https://www.instagram.com/szumksufko/",
                "https://www.imdb.com/name/nm17906294/",
              ],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Wien",
                addressCountry: "AT",
              },
              knowsAbout: [
                "Production Sound",
                "Audio Post-Production",
                "Mixing",
                "Mastering",
                "Music Production",
                "Sound Design",
              ],
            }),
          }}
        />
      </head>
      {/* overflow-hidden because actual page scroll happens inside the
          PageScroll ScrollArea below. Without this, native scrollbars
          can still appear if children overflow the body. */}
      <body className="console-chassis text-ink antialiased overflow-hidden h-svh">
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
                and MobileConsole takes over: two floating islands — a
                Pro-Tools-style scrub transport pinned top, the controls +
                swipeable volume pinned bottom. */}
            <div className="flex h-svh w-full items-stretch">
              <LeftRail />
              <Island>
                <Scene />
                <PageScroll>{children}</PageScroll>
              </Island>
              <KnobRail />
            </div>
            <MobileConsole />
            <ConsoleHotkeys />
          </ScrollProvider>
          </LanguageProvider>
          </AudioProvider>
        </ThemeProvider>

        {/* Cinematic grade pass — light desaturation + filmic contrast +
            vignette, reading the composited page. Sits at z-55, just UNDER the
            grain, so the grain dusts the already-graded image. */}
        <PostFx />

        {/* Page-wide film grain — one GPU layer over EVERYTHING (scene,
            console, type), rendered at full device resolution, screen-blended
            so the whole page reads as one filmic surface. Outside the providers
            since it needs no app state; last child so it composites on top. */}
        {/* Fine grain (1 physical px/cell) — razor-fine, NOT chunky; strength is
            amount, not cell size. LAST child of <body> at z-60 so it composites
            over EVERYTHING incl. the editorial type. blend="overlay" is the key to
            "grain actually impacts the text": overlay pivots on mid-grey, so it
            ADDS tooth on the dark scene AND carves grain INTO the cream glyphs —
            unlike screen, which is near-identity on bright type. amount is lower
            here than a screen layer because overlay bites much harder. */}
        <GrainOverlay grainPx={1.0} amount={0.22} blend="overlay" />
      </body>
    </html>
  );
}
