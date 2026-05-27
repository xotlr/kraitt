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
      {/* CA filter on <main> only. Excludes Nav (above) which is
          position:fixed; CSS `filter:` creates a new containing block
          that would break that. willChange hints compositor. */}
      <main
        className="relative z-10"
        style={{ filter: "url(#ca)", willChange: "filter" }}
      >
        <Hero />
        <Ueber />
        <Leistungen />
        <Referenzen />
        <Kontakt />
      </main>
    </>
  );
}
