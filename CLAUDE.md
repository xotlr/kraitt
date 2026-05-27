# Sufian Kraitt — Audio / Film Portfolio

A personal site for an audio engineer working across film, TV, and music.
Dark, cinematic, type-led. The visual identity is **a live shader that
behaves like a vibrating instrument** — warm noise blobs and thin strings
that pluck in response to the cursor. The shader is the brand.

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
- No images, no icons in section content (per Sufian's brief, reinforced
  by the shader doing the visual lifting).
- Hairline dividers, not solid blocks.
- One accent color (amber) — it appears in *italic accents* and in the
  shader peaks. Nowhere else.

### 3. Honest performance gates

The shader is the most expensive thing on the page. The rules:

- Frame-cap to 30fps desktop / 20fps mobile. 60fps for a slow drifting
  noise field is wasted heat.
- Pause when the tab is hidden.
- Skip entirely on low-end devices (`navigator.deviceMemory <= 1` or
  `hardwareConcurrency <= 1`).
- Render one static frame for `prefers-reduced-motion`, then stop.
- DPR capped at 1 on viewports `< 1024px`. The shader is soft; the
  extra pixels are invisible but the fill cost is real on integrated
  GPUs.

These rules survive any rewrite. If a future change drops one, justify
it explicitly.

### 4. Where logic lives

- `src/components/grainient.tsx` (or its r3f-flavored successor)
  is the shader and only the shader. No business logic, no content.
- `src/components/sections/*.tsx` are content + layout. They render
  the shader as a background once, at the root layout — sections never
  re-instantiate it.
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
    layout.tsx          Root layout + shader mount + fonts
    page.tsx            Composes all sections
    globals.css         Tailwind 4 @theme + tokens
  components/
    grainient.tsx       The shader (will become r3f-based)
    nav.tsx             Fixed top nav with section observers
    section-heading.tsx Shared heading block
    sections/           One file per landing section
    ui/                 Radix-based primitives (Dialog)
  data/projects.ts      Project data (typed)
  hooks/                React hooks (device capability, etc.)
  lib/utils.ts          cn() helper
```

## Running

- `bun dev` — http://localhost:3000
- `bun run build` — production build (Turbopack)
- `bunx tsc --noEmit` — typecheck
