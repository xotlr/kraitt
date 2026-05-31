/**
 * Dev-only guard against dead shader uniforms.
 *
 * We kept finding uniforms that were declared in the JS uniforms object (and
 * often written every frame in useFrame) but never actually read by any shader
 * stage — uScroll, uColor, uMid, uHigh. The GPU silently optimises them out,
 * so nothing breaks and nothing warns; the dead upload just sits there until a
 * manual audit catches it. This closes that bug class: it cross-checks every
 * uniform name against the shader source and warns on any that no stage reads.
 *
 * No-op in production (stripped by the `process.env.NODE_ENV` check + dead-code
 * elimination). Call it once near the shader/uniform definitions.
 */
export function assertUniformsUsed(
  label: string,
  uniforms: Record<string, unknown>,
  ...shaderSources: string[]
): void {
  if (process.env.NODE_ENV === "production") return;

  const src = shaderSources.join("\n");
  const dead = Object.keys(uniforms).filter((name) => {
    // A used uniform appears at least twice in the combined source: once in its
    // `uniform <type> <name>;` declaration and at least once where it's read.
    // A dead one appears exactly once (declaration only) or — if the dev forgot
    // to even declare it — zero times. `\b` keeps uFog from matching uFogColor.
    const re = new RegExp(`\\b${name}\\b`, "g");
    const hits = (src.match(re) ?? []).length;
    return hits < 2;
  });

  if (dead.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[scene/${label}] uniform(s) declared but never read by any shader stage: ` +
        `${dead.join(", ")}. Either wire them into the shader or remove them ` +
        `(declaration + JS init + any useFrame write).`
    );
  }
}
