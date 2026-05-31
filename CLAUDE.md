# Sufian Kraitt — Audio / Film Portfolio

A personal site for an audio engineer working across film, TV, and music.
Dark, cinematic, type-led. The site is framed as a **studio monitor**: a
rounded "island" card is the screen, the black gutter around it is the
bezel/matte, and console rails (section nav, audio inputs, theme/language)
frame the screen like a mixing desk. Inside the screen is **a live r3f
scene that behaves like a vibrating instrument** — a 3D vertex-displaced
terrain whose waves react to the cursor and to audio, under a cinematic
post-processing stack. The scene is the brand.

## Stack

- Next.js 16 (Turbopack) · React 19 · TypeScript
- Tailwind 4 (CSS-first `@theme`)
- Framer Motion (sparingly — for type reveals and layout transitions)
- Three.js + react-three-fiber + @react-three/drei (shader pipeline)
- Radix primitives (Dialog only) · Bun

## Design rules

- **The scene is the brand; UI frames it, never competes.** If a UI
  element fights the scene for attention (thick borders, heavy buttons,
  busy illustrations), the element is wrong.
- **Fraunces at weight 200–300.** Heavier muddies the warm peaks.
- **One accent color (amber)** — italic accents and shader peaks only.
- **Hairline dividers, not solid blocks.**
- **No images, no icons in section content.** The console chrome is the
  deliberate exception: rails use Phosphor icons
  (`@phosphor-icons/react`) for the tactile studio buttons. Icons stay
  out of the editorial body.
- **Add a dependency only if it reduces complexity elsewhere.** Dialog
  earns Radix; bespoke type buttons don't. Typed `.ts` data in
  `src/data/`, no CMS / backend until the need is real.

## Performance gates

The scene is the most expensive thing on the page. Current status
(`src/components/scene/index.tsx`, `src/hooks/use-device-capability.ts`):

- **[DONE] Frame-cap to 30fps desktop / 20fps mobile.** Canvas runs
  `frameloop="demand"`; `FrameCap` (`scene/frame-cap.tsx`) is the sole
  `invalidate()` pump, on a self-correcting timer at 30 (desktop) / 20
  (mobile). Fixed-coefficient eases settle proportionally slower at the cap —
  an accepted trade.
- **[DONE] Pause when the tab is hidden.** `visibilitychange` flips
  `FrameCap` to `fps=null` (no pump → holds last frame); restores on return.
- **[DONE] Skip on low-end devices** (`deviceMemory <= 1` or
  `hardwareConcurrency <= 1` → tier `low` → `Scene` returns null).
- **[DONE] `prefers-reduced-motion`** → `FrameCap` `fps=null`: no pump runs,
  the scene holds a static frame.
- **[DONE] DPR capped at 1 below 1024px** (`[1, 1.5]` above, `1` below).

These gates survive any rewrite. All five are now enforced; removing any
gate needs an explicit justification.

## Where logic lives

- `src/components/scene/*.tsx` — the r3f scene and only the scene
  (`index.tsx` composes; `atmosphere.tsx`, `terrain.tsx`,
  `camera-rig.tsx` are its parts; `frame-cap.tsx` throttles the loop;
  `glsl-noise.ts` is the shared simplex shared by the two shaders). No
  business logic, no content.
- `src/components/island.tsx` — monitor-bezel frame containing the scene;
  `src/components/console/*` — desk chrome (rails, studio buttons, level
  meter, theme/language/audio toggles). Section nav lives here, not in a
  standalone `nav.tsx`.
- `src/components/sections/*.tsx` — content + layout. The scene is mounted
  once (inside the island), not per section. Sections are German-named:
  `hero`, `ueber`, `leistungen`, `referenzen`, `kontakt`.
- `src/lib/*` — cross-cutting contexts and the audio engine (`audio.tsx`,
  `theme-context.tsx`, `language-context.tsx`, `scroll-context.tsx`,
  `utils.ts`).
- `src/data/*.ts` — typed content. The site has no database.

## Running

- `bun dev` — http://localhost:3000
- `bun run build` — production build (Turbopack)
- `bunx tsc --noEmit` — typecheck

## Pre-deploy checklist

**Audio asset is unlicensed.** `/public/audio/ambient.mp3` is currently
expected to be a track from the *Clair Obscur: Expedition 33* OST
("Une Vie à t'Aimer"), used as a development-only placeholder. This is
© Sandfall Interactive / Lorien Testard. **It MUST be replaced before
any public deploy** with either:

- a public-domain recording (e.g. IMSLP performance-PD entries), or
- a properly licensed track (paid commercial license or CC-BY with
  attribution rendered somewhere on the site), or
- silence — remove the music toggle entirely, keep only the mic input

Referenced from `src/lib/audio.tsx` (the `MUSIC_SRC` constant and the
comment above it).
