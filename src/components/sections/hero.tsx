"use client";

import { motion } from "framer-motion";
import { useScrollTo } from "@/lib/scroll-context";
import { useAudioGlow } from "@/hooks/use-audio-glow";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";

// The hero has NO load-in animation — it renders static (the user asked to
// drop the slide/fade reveals). The only motion left is the dot's hover.
//
// The audio tint/glow lives on the Fraunces accents (the .audio-accent class
// in globals.css), not the sans wordmark. useAudioGlow writes --audio-tint /
// --audio-glow onto the intro paragraph so the italic accents inside it warm
// and bloom with the music while the display wordmark stays neutral ink.

export function Hero() {
  const scrollTo = useScrollTo();
  // Audio tint now lives on the Fraunces accents in the body line (Film /
  // television / music), not the sans wordmark. The ref goes on that
  // paragraph so its .audio-accent spans inherit --audio-tint / --audio-glow.
  const introRef = useAudioGlow<HTMLParagraphElement>();
  const { lang } = useLanguage();
  const t = dict(lang).hero;
  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex flex-col justify-between overflow-hidden"
    >
      <div className="relative z-10 container-edge pt-32 md:pt-40">
        <p className="eyebrow flex items-center gap-3">
          <span className="h-px w-10 bg-ink-faint" />
          {t.eyebrow}
        </p>
      </div>

      <div className="relative z-10 container-edge">
        {/* Static wordmark — no load animation, ONE typeface (Geist). Both
            lines are the same sans; "Kraitt." just rests a step muted as the
            family name. The accessible name is on the <h1>; the spans are
            aria-hidden. */}
        <h1
          aria-label="Sufian Kraitt"
          className="font-display text-display leading-[var(--text-display--line-height)] text-balance text-legible text-ink"
        >
          <span className="block" aria-hidden>
            Sufian
          </span>
          <span className="block text-ink-muted" aria-hidden>
            Kraitt
            {/* Dot picks up the string color so the wordmark belongs to the
                same cold palette as the shader. Grows slightly on hover — the
                only interactive flourish on the hero. */}
            <motion.span
              whileHover={{ scale: 1.15 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block text-[color:var(--color-string)] origin-bottom"
              aria-hidden
            >
              .
            </motion.span>
          </span>
        </h1>

        <p
          ref={introRef}
          style={{ ["--audio-glow" as string]: 0 }}
          className="mt-12 md:mt-16 max-w-[50ch] text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body text-legible"
        >
          {t.leadIn}
          <span className="text-accent audio-accent">{t.film}</span>,{" "}
          <span className="text-accent audio-accent">{t.television}</span>
          {lang === "de" ? " und " : ", "}
          <span className="text-accent audio-accent">{t.music}</span>
          {t.leadOut}
        </p>
      </div>

      <div className="relative z-10 container-edge pb-12 md:pb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 eyebrow">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-ink-muted">
            {t.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <a
            href="#ueber"
            onClick={scrollTo("ueber")}
            className="group inline-flex items-center gap-3 text-ink-muted hover:text-ink transition-colors"
          >
            {t.scroll}
            <span className="block h-px w-12 bg-current group-hover:w-20 transition-all duration-700" />
          </a>
        </div>
      </div>
    </section>
  );
}
