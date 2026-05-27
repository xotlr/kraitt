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
