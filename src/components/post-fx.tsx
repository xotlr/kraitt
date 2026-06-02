"use client";

/**
 * PostFx — a single full-page cinematic grade layer, the "color/VFX pass" that
 * sits between the page and the film grain. Three effects, one fixed element,
 * all razor-sharp (no blur, so it never softens the UHD render):
 *
 *  1. FILMIC GRADE — a `backdrop-filter` reading the composited page:
 *     - saturate(0.86): a LIGHT global desaturation (~14%) that cools the whole
 *       palette toward the console's grey register. NOT a full wash — the amber
 *       accents + scene peaks survive as the one warm signal (desaturating them
 *       to death would kill the brand's "warmth = sound" thesis).
 *     - contrast(1.06) + brightness(0.99): a gentle filmic S — blacks sit a hair
 *       deeper, the midtones firm up, so the page grades like film stock instead
 *       of flat sRGB.
 *  2. VIGNETTE — a radial darkening pulling focus to the screen centre, like a
 *     lens / studio monitor looked at through glass. Corners ~ -14%, centre clean.
 *  3. (grain is a SEPARATE layer above this — see GrainOverlay.)
 *
 * pointer-events-none, aria-hidden, fixed inset-0. Sits at z-55 — ABOVE all
 * content + chrome, BELOW the z-60 grain (grain should dust the graded image,
 * not get graded itself). backdrop-filter degrades gracefully: unsupported
 * browsers just get the vignette.
 */
export function PostFx() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55]">
      {/* Filmic grade — backdrop-filter reads the composited page beneath. */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "saturate(0.86) contrast(1.06) brightness(0.99)",
          WebkitBackdropFilter: "saturate(0.86) contrast(1.06) brightness(0.99)",
        }}
      />
      {/* Vignette — radial falloff to the corners. Slightly taller-than-wide
          ellipse so the darkening hugs the screen edges on widescreen without
          pinching the centre. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 45%, transparent 55%, color-mix(in srgb, black 14%, transparent) 100%)",
        }}
      />
    </div>
  );
}
