# Scene plan — Death Stranding feel + directional "conductor" terrain

Status: **proposed** (not yet implemented)
Scope: the r3f scene only (`src/components/scene/*`). No content, layout, or
console-chrome changes. Dark mode only — every change is gated behind `uTheme`
so light/paper mode stays clean.

## Why

The landing scene already reads as an **audio engineer's desk** (console rails,
VU, segmented meter, fader). The **Death Stranding** half of the brief is
referenced — contour topography, cold dark palette — but undercooked:

- The terrain is **flat dark-grey contours on dark-grey**. It barely separates
  from the bed. DS terrain *glows out of near-black*.
- **No atmospheric depth.** `depthFade` is a flat distance band; there's no
  horizon, no haze, so no sense of vast empty distance.
- **No sculpted light.** Surface shading is pure height (`vHeightNorm`), so the
  land reads as a gradient, not as lit terrain.
- **The amber accent never touches the scene.** Per `CLAUDE.md`, amber is for
  shader peaks — but the terrain is monochrome; only the type and meter carry it.

And separately, the audio reactivity is **un-directional**: every band pumps the
whole surface up/down in Y in unison (a "uniform pump"). The brief wants it to
behave like a **music director** — point *left*, then *right*, push *faster* —
energy that has a **direction across the plane** which sweeps and changes over
time, not just height.

## Two threads

1. **Death Stranding look** (§1–§5, §8) — luminosity, depth, sculpted light,
   amber-on-ridge, ground haze.
2. **Directional "conductor" motion** (§6–§7) — energy gains a heading that
   sweeps left↔right and changes tempo, layered as a traveling wavefront on top
   of a directional lean.

Implement look-thread first (§1–§3) for the biggest visual payoff, screenshot,
then the conductor thread (§6–§7), then the accents (§4–§5, §8).

---

## Decisions (locked)

- **Conductor drive = auto-conductor.** An internal LFO sweeps the direction
  on its own, like a baton; **sweep rate scales with mid/tempo** so loud
  passages cue faster. No cursor or user input required — it always looks alive.
  (Cursor-conducted and stereo/band-split were considered and rejected for v1;
  auto keeps it self-driving and robust in screenshots/idle.)
- **Gesture feel = both layered.** A traveling **wavefront** that sweeps across
  the plane in the current direction, *on top of* an **anisotropic lean** (waves
  elongate along the heading, compress across it). Strongest "being conducted"
  read.

---

## §1 — Lift the contours off the bed (luminosity)

**File:** `terrain.tsx` fragment shader; `index.tsx` Bloom.

- Add a **vertical luminance gradient** to the line color: contours toward the
  horizon glow brighter, foreground lines sit calmer — the "land emerging from
  haze" read. Drive off `vCameraDist` (or a remapped `vWorldPos`/depth).
- Re-tune `Bloom` (currently `luminanceThreshold 0.32 / intensity 0.7`, set high
  to keep the bed black). With brighter lines, lower threshold + raise intensity
  (~`0.28 / 0.9`) so **ridgelines glow** — but the surface fill (luminance
  ≈0.02–0.29) must stay *below* threshold or bloom greys the whole bed.
  **This is the single highest-impact change.**

**Guard:** verify the OLED bed stays genuinely #000, not lifted to grey, after
the bloom retune. Test with audio off (idle) and on (peaks).

## §2 — Atmospheric depth (fog falloff to a horizon)

**File:** `terrain.tsx` fragment shader.

- Replace the flat `depthFade = smoothstep(12.0, 2.5, vCameraDist)` band with a
  **two-part falloff**: a near band keeping the foreground crisp + an
  **exponential haze** toward the far plane so terrain dissolves into the bed at
  a *defined horizon* rather than a uniform fade.
- **Tie the haze tint to the atmosphere bed color** (share the constant or pass
  it as a uniform) so terrain and background meet seamlessly instead of the
  terrain floating on black.

## §3 — Cold rim / key light on the ridges (sculpted form)

**File:** `terrain.tsx` fragment shader.

- `surfaceShade` is pure `vHeightNorm` today. Add a **cheap directional shading
  term**: approximate the surface normal from the wave height (analytic
  derivative of the wave sum in the vertex shader passed as a varying, or
  `dFdx/dFdy` of height in the fragment shader) and light from a **low, cold
  key**. Ridges facing the light get a pale cold-blue lift; faces turned away
  fall to black. Low-key, not a sunlit hero shot.
- Makes the surface read as **sculpted land**, not a gradient.

## §4 — Audio peaks bleed amber into the ridges (on-brand accent)

**File:** `terrain.tsx` fragment shader.

- Today `goldMix` warms *every* line globally on loud bass, to a desaturated
  grey-gold (`#998f82`). Instead: make the warm accent **real amber** (the
  site's one accent) and **localize it to the high parts of wave crests during
  peaks** (gate on `vHeightNorm` × beat energy), so a beat sends **amber glow
  rippling along the ridgelines** — the landscape itself reacting. On-brand
  (amber = shader peaks) and the DS "luminous terrain" note in one move.

## §5 — Ground-fog haze band in the bed

**File:** `atmosphere.tsx` fragment shader.

- The bed is uniform OLED-black + faint pockets. Add a **very faint vertical
  haze gradient** in the lower third — a cold near-black lift reading as ground
  fog the terrain emerges from. Subtle enough to stay "OLED black" per CLAUDE.md
  identity, but gives the terrain something to sit *in*.

---

## §6 — Directional energy: the "conductor" heading

**File:** `terrain.tsx` — vertex shader + `useFrame` uniforms.

The core change. Today each band's energy rides a per-band scalar "field" that
drifts, but height is summed into Y uniformly. Introduce a **heading vector**
`uDir` (a unit `vec2` on the XZ plane) that the energy points along.

- **Auto-conductor LFO** (drives `uDir`), computed in `useFrame` (JS) and passed
  as a uniform so it's cheap and identical across all vertices:
  ```
  // baton angle sweeps left<->right; rate rises with mid/tempo
  rate  = base + midEnergy * gain          // louder = faster cueing
  angle = swing * sin(phase)               // phase advances by rate each frame
  uDir  = vec2(cos(angle), sin(angle))
  ```
  `swing` bounds the sweep (e.g. ±60°) so it gestures left↔right rather than
  spinning. `phase` is accumulated in a ref (not `t*rate`, so rate changes don't
  jump the phase). Add a slow second harmonic so it doesn't feel metronomic.
- **Tempo coupling:** `rate` scales with the eased mid level (already have
  `ampMid`). A busy passage visibly cues faster; a calm one drifts slow. Clamp
  so it never strobes.

## §7 — Layered read: traveling wavefront + anisotropic lean

**File:** `terrain.tsx` vertex shader.

Use `uDir` in two superimposed ways (the "both layered" decision):

1. **Traveling wavefront** — a swell band whose crest sweeps **along `uDir`**:
   ```
   d         = dot(uDir, position.xy);     // distance along the heading
   frontPhase = d * frontFreq - frontSpeed * uTime;
   wavefront = sin(frontPhase) * env(d) * audioEnergy;
   ```
   `frontSpeed`/`frontFreq` tuned so you *see* a swell travel left, then — as
   `uDir` turns — sweep right. `env(d)` keeps it a band, not a full-plane lift.
2. **Anisotropic lean** — bias the existing wave directions toward `uDir` so the
   whole texture **elongates along the heading and compresses across it**. Cheap:
   rotate the wave sample coords by the heading, or scale per-wave frequency by
   `abs(dot(waveDir, uDir))`. The field "leans" the way the conductor points.

Net effect: a swell sweeps across the plane in the cued direction *and* the
texture leans with it — energy with a **location, a velocity, and a heading**
that changes over time. Replaces the uniform up/down pump.

**Keep:** the radial beat-pulse ring (§ existing) — it composes fine on top and
reads as the "downbeat" punctuating the sweeping gesture.

---

## §8 — Post-stack pass (after §1–§7 land)

**File:** `index.tsx`.

Re-check Bloom / Vignette / ChromaticAberration once the scene is brighter and
has depth. Likely only Bloom needs the §1 retune; CA/Vignette stay restrained
per the existing VFX-audit comments.

---

## Non-goals / guarantees

- **Performance gates preserved** (`CLAUDE.md` §Performance). Every change is
  fragment-shader math, a few extra vertex ALU ops, and post-pass params —
  **no new geometry, no per-vertex FBM added, no new draw calls.** `uDir` and
  the conductor LFO are computed once per frame in JS and passed as uniforms.
  `frameloop`, DPR cap, tab-hidden pause, device-skip all untouched.
- **Light/paper theme stays clean** — all new terms gated behind `uTheme`; DS
  treatment is dark-mode only.
- **Console chrome / type / layout untouched** — the audio-engineer half already
  lands; this is scene-only.
- **Fraunces / single amber accent / hairline rules** respected — the only new
  color is amber on ridges (§4), which is the sanctioned accent.

## Implementation order

1. §1 §2 §3  → screenshot (glow + depth + sculpted light = ~80% of the DS feel)
2. §6 §7     → screenshot (the conductor motion — the headline new behavior)
3. §4 §5 §8  → screenshot (amber accent, ground haze, post retune)

Each step is independently revertible. Verify after each via the Playwright MCP
browser in **dark mode with audio on**, confirming: no console errors, bed stays
true black, and the directional sweep reads as a gesture (not a uniform pump).

## Risk notes

- **Bloom greying the bed** (§1) is the main aesthetic risk — the existing high
  threshold exists precisely to prevent it. Re-tune carefully against idle.
- **Conductor strobing** (§6) if `rate` is uncoupled from a clamp on loud audio.
  Clamp `rate` and ease `uDir` so the heading turns smoothly, never snaps.
- **Anisotropic lean over-stretching** (§7.2) into visible streaks — keep the
  frequency bias modest; the wavefront (§7.1) should carry most of the "gesture."
