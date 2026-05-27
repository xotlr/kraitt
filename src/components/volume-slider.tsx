"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAudio } from "@/lib/audio";

/**
 * Vertical-fader volume control — sits on the left edge of the
 * viewport, visible only when music is playing. Reads + writes the
 * audio context's volume.
 *
 * Implementation note: we use a native <input type="range"> rotated
 * 270deg so we get a real draggable thumb with keyboard a11y, focus
 * outline, screen-reader support for free. Styled to look like a
 * mixing-console fader rather than a browser default.
 */
export function VolumeSlider() {
  const { musicOn, volume, setVolume } = useAudio();

  return (
    <AnimatePresence>
      {musicOn && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-4 pointer-events-auto"
        >
          {/* mono label, eyebrow style */}
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
            Vol
          </span>

          {/* Vertical fader. The container is the visual track; the
              actual <input> is rotated and absolutely positioned to
              fill the container's height. */}
          <div className="relative h-40 w-2 flex items-center justify-center">
            {/* Track: thin hairline column */}
            <div className="absolute inset-x-0 mx-auto w-px h-full bg-hairline" />

            {/* Filled portion: from bottom up to current volume. */}
            <div
              className="absolute bottom-0 inset-x-0 mx-auto w-px bg-ink-muted transition-[height] duration-150"
              style={{ height: `${volume * 100}%` }}
              aria-hidden
            />

            {/* Rotated native range input. -webkit-appearance:none on
                modern browsers; we style the thumb via CSS below.
                Width matches the track height after rotation. */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label="Lautstärke"
              className="volume-fader absolute origin-center -rotate-90"
              style={{ width: "160px", height: "16px" }}
            />
          </div>

          {/* Numeric readout — quiet, mono, fades unless the user is
              actively adjusting. We just keep it visible at low contrast
              all the time for now. */}
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint tabular-nums">
            {Math.round(volume * 100).toString().padStart(2, "0")}
          </span>

          <style jsx>{`
            .volume-fader {
              -webkit-appearance: none;
              appearance: none;
              background: transparent;
              cursor: ns-resize;
            }
            .volume-fader:focus {
              outline: none;
            }
            .volume-fader::-webkit-slider-runnable-track {
              background: transparent;
              height: 16px;
            }
            .volume-fader::-moz-range-track {
              background: transparent;
              height: 16px;
            }
            .volume-fader::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 10px;
              height: 10px;
              border-radius: 9999px;
              background: var(--color-ink);
              border: 1px solid var(--color-canvas);
              cursor: ns-resize;
              transition: transform 0.2s ease, background 0.3s ease;
            }
            .volume-fader:hover::-webkit-slider-thumb,
            .volume-fader:focus::-webkit-slider-thumb {
              transform: scale(1.2);
            }
            .volume-fader::-moz-range-thumb {
              width: 10px;
              height: 10px;
              border-radius: 9999px;
              background: var(--color-ink);
              border: 1px solid var(--color-canvas);
              cursor: ns-resize;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
