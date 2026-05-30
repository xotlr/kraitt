# Sufian Kraitt — Audio / Film Portfolio

A personal site for an audio engineer working across film, TV, and music.
Dark, cinematic, type-led. The site is framed as a **studio monitor**: a
rounded "island" card is the screen, the black gutter around it is the
bezel/matte, and console rails (section nav, audio inputs, theme/language)
frame the screen like a mixing desk. Inside the screen is **a live r3f
scene that behaves like a vibrating instrument** — a 3D vertex-displaced
terrain whose waves react to the cursor and to audio, under a cinematic
post-processing stack. The scene is the brand.

> Note: earlier iterations described "noise blobs and thin strings." That
> shader (`grainient.tsx`) has been replaced by the 3D terrain scene under
> `src/components/scene/`. Strings/pluck were the design intent and now
> read as cursor/audio-driven wave ripples, not literal string geometry.

## Stack

- Next.js 16 (Turbopack) · React 19 · TypeScript
- Tailwind 4 (CSS-first `@theme`)
- Framer Motion (sparingly — for type reveals and layout transitions)
- Three.js + react-three-fiber + @react-three/drei (shader pipeline)
- Radix primitives (Dialog only) · Bun

## Architectural principles

### 1. Pick the primitive that scales with what's coming next, not what's here today

The shader is the most architecturally consequential decision on this site.
There are two correct-looking choices:

- **Raw WebGL** — minimal, no dependency cost, full control. The right call
  if the shader is small and frozen.
- **Three.js (+ react-three-fiber)** — heavier, but a real render graph,
  declarative scene, automatic disposal, ecosystem for post-processing.

We pick **Three.js + r3f**, even though the raw WebGL version is shorter
*today*. The reasons:

- The shader is going to grow. Strings, ignition, cursor reactivity,
  potentially per-section variants. Every new feature in raw WebGL = JS
  plumbing + GLSL changes in two places.
- The second time you want to compose passes (e.g. bloom on the strings),
  raw WebGL means writing your own framebuffer/render-target dance.
  r3f makes that one extra component.
- Disposal correctness on hot-reload and route transitions is non-trivial
  in raw WebGL. r3f handles it.
- The bundle delta (~80–120kb gz, tree-shaken) is amortized across the
  whole site's lifetime, and this is a portfolio that's loaded once and
  cached. Marketing-site logic ("every kb matters") does not apply.

**The "overkill" reflex is the wrong heuristic.** "Overkill" should mean
*complexity that does not pay off*. If the second feature in the same
domain is already on the roadmap, the framework is not overkill — it's
the correct level of abstraction.

Same principle applies elsewhere:
- shadcn primitives only when we actually need a primitive (Dialog yes;
  Button no, the buttons here are bespoke type)
- A CMS only if Sufian will edit content himself; otherwise typed `.ts`
  data files in `src/data/`
- A backend for the contact form only when spam volume justifies it

### 2. The visual identity is non-negotiable; everything else bends to it

The shader runs on every section. Type weight, spacing, color tokens
exist to *frame* the shader, not compete with it. If a UI element fights
the shader for attention (thick borders, heavy buttons, busy
illustrations), the UI element is wrong.

Concrete consequences:
- Fraunces at weight 200–300 — anything heavier muddies the warm blobs.
- No images, and no icons *in section content* (per Sufian's brief,
  reinforced by the shader doing the visual lifting). The console chrome
  is the deliberate exception: the rails use Phosphor icons
  (`@phosphor-icons/react`) for the tactile studio buttons, because the
  desk metaphor needs glyphs. Icons stay out of the editorial body.
- Hairline dividers, not solid blocks.
- One accent color (amber) — it appears in *italic accents* and in the
  shader peaks. Nowhere else.

### 3. Honest performance gates

The scene is the most expensive thing on the page. The rules, with
current implementation status (`src/components/scene/index.tsx`,
`src/hooks/use-device-capability.ts`):

- **[NOT YET ENFORCED] Frame-cap to 30fps desktop / 20fps mobile.** The
  scene currently runs `frameloop="always"` (full rAF, ~60fps). The cap
  is intended but not implemented — the terrain has more visible motion
  than the old drifting noise field, so the "60fps is wasted heat"
  argument is weaker here, but the gate still belongs. Do not treat this
  as done.
- **[NOT YET ENFORCED] Pause when the tab is hidden.** No
  `visibilitychange`/`document.hidden` handling exists yet. r3f keeps
  rendering in a backgrounded tab. This should be added.
- **[DONE] Skip entirely on low-end devices** (`deviceMemory <= 1` or
  `hardwareConcurrency <= 1` → tier `low` → `Scene` returns null).
- **[PARTIAL] `prefers-reduced-motion`** sets `frameloop="demand"` so the
  scene holds a static frame instead of animating. (Not a hard one-frame
  stop, but functionally a still image.)
- **[DONE] DPR capped at 1 on viewports `< 1024px`** (`[1, 1.5]` above,
  `1` below). The scene is soft; the extra pixels are invisible but the
  fill cost is real on integrated GPUs.

These rules survive any rewrite. The two NOT-YET-ENFORCED gates are debt,
not deletions — they should be implemented, not silently dropped. If a
future change removes any gate, justify it explicitly.

### 4. Where logic lives

- `src/components/scene/*.tsx` is the r3f scene and only the scene
  (`index.tsx` composes it; `atmosphere.tsx`, `terrain.tsx`,
  `camera-rig.tsx` are its parts). No business logic, no content.
  `grainient.tsx` no longer exists.
- `src/components/island.tsx` is the monitor-bezel frame that contains
  the scene; `src/components/console/*` is the desk chrome (rails,
  studio buttons, level meter, theme/language/audio toggles).
- `src/components/sections/*.tsx` are content + layout. The scene is
  mounted once (inside the island, not re-instantiated per section).
  Sections are German-named: `hero`, `ueber`, `leistungen`,
  `referenzen`, `kontakt`.
- `src/lib/*` holds the cross-cutting contexts and the audio engine:
  `audio.tsx`, `theme-context.tsx`, `language-context.tsx`,
  `scroll-context.tsx`, `utils.ts`.
- `src/data/*.ts` is typed content. The site has no database.

### 5. Honesty in the work

- If a feature is half-finished, say so. Don't ship `// TODO`s as if
  they're complete.
- If a design call is opinionated, name it as opinionated, not as
  best practice.
- If a dependency was added, it earns its place by reducing complexity
  elsewhere. If it doesn't, remove it.

## Project layout

```
src/
  app/                  Next App Router
    layout.tsx          Root layout: providers, island + console mount, fonts
    page.tsx            Composes all sections
    globals.css         Tailwind 4 @theme + tokens
  components/
    island.tsx          Monitor-bezel frame; contains the scene
    page-scroll.tsx     Scroll container / progress wiring
    section-heading.tsx Shared heading block
    scene/              r3f scene (index, atmosphere, terrain, camera-rig)
    console/            Desk chrome: rails, studio buttons, meter, toggles
    sections/           One file per landing section (German-named)
    ui/                 Radix-based primitives (dialog, scroll-area)
  data/projects.ts      Project data (typed)
  hooks/                React hooks (device-capability, audio-glow)
  lib/                  audio engine + theme/language/scroll contexts, utils
```

> Nav is no longer a standalone `nav.tsx` — section navigation lives in
> the console rails (`components/console/`) and is mounted from
> `layout.tsx`.

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

The file is referenced from `src/lib/audio.tsx` (see the `MUSIC_SRC`
constant and the comment immediately above it).
