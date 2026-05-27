import { Nav } from "@/components/nav";
import { Hero } from "@/components/sections/hero";
import { Kontakt } from "@/components/sections/kontakt";
import { Leistungen } from "@/components/sections/leistungen";
import { Referenzen } from "@/components/sections/referenzen";
import { Ueber } from "@/components/sections/ueber";

export default function Home() {
  return (
    <>
      <Nav />
      {/* No DOM CA filter here — the SVG `#ca` filter from layout.tsx
          would flatten this subtree into its own composited layer
          and the edge-blur overlay (using backdrop-filter) cannot
          read through that. Picking edge-blur over DOM CA because
          the lens-defocus effect is more impactful for cinematic
          feel. The WebGL canvas still has its own ChromaticAberration
          post-pass, so the terrain itself fringes. */}
      <main className="relative z-10">
        <Hero />
        <Ueber />
        <Leistungen />
        <Referenzen />
        <Kontakt />
      </main>
    </>
  );
}
