import { Hero } from "@/components/sections/hero";
import { Kontakt } from "@/components/sections/kontakt";
import { Leistungen } from "@/components/sections/leistungen";
import { Referenzen } from "@/components/sections/referenzen";
import { Ueber } from "@/components/sections/ueber";

export default function Home() {
  // Nav now lives in layout.tsx so it floats over the island bezel,
  // outside the rounded card. z-10 keeps the sections above the
  // shader (z-0) inside the island's clip.
  return (
    <main className="relative z-10">
      <Hero />
      <Ueber />
      <Leistungen />
      <Referenzen />
      <Kontakt />
    </main>
  );
}
