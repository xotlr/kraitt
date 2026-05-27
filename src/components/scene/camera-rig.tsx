"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useScrollViewport } from "@/lib/scroll-context";

/**
 * Scroll-driven camera dolly. As the user scrolls down the page, the
 * camera walks forward into the landscape (and rises slightly), so
 * the visitor genuinely traverses the terrain rather than watching
 * it morph in place. Reads scroll from the ScrollArea viewport via
 * the same context the rest of the scroll-linked code uses.
 *
 * Path:
 *   scroll = 0:    (0, 0.8, 3.5)  looking at (0, -0.2, -2.5)
 *   scroll = 1:    (0, 1.6, -2.0) looking at (0, -0.4, -8.0)
 *
 * Camera walks forward ~5.5 wu and rises ~0.8 wu over the full page
 * scroll. The lookAt target moves with it so the camera doesn't
 * pivot, just translates — feels like steady forward motion.
 */
const TOP_POS = new THREE.Vector3(0, 0.8, 3.5);
const BOTTOM_POS = new THREE.Vector3(0, 1.6, -2.0);
const TOP_LOOK = new THREE.Vector3(0, -0.2, -2.5);
const BOTTOM_LOOK = new THREE.Vector3(0, -0.4, -8.0);

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const viewportRef = useScrollViewport();

  const targetProgress = useRef(0);
  const currentProgress = useRef(0);
  const posScratch = useRef(new THREE.Vector3());
  const lookScratch = useRef(new THREE.Vector3());

  useEffect(() => {
    const update = () => {
      const el = viewportRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      targetProgress.current = max > 0 ? el.scrollTop / max : 0;
    };
    const id = requestAnimationFrame(() => {
      update();
      const el = viewportRef.current;
      if (el) el.addEventListener("scroll", update, { passive: true });
    });
    return () => {
      cancelAnimationFrame(id);
      const el = viewportRef.current;
      if (el) el.removeEventListener("scroll", update);
    };
  }, [viewportRef]);

  useFrame(() => {
    // Low-pass smooth so scroll doesn't snap the camera.
    currentProgress.current +=
      (targetProgress.current - currentProgress.current) * 0.08;
    const p = currentProgress.current;
    // Ease so the early portion has more motion (the "walk in" feel).
    const eased = 1 - Math.pow(1 - p, 1.6);

    posScratch.current.lerpVectors(TOP_POS, BOTTOM_POS, eased);
    lookScratch.current.lerpVectors(TOP_LOOK, BOTTOM_LOOK, eased);
    camera.position.copy(posScratch.current);
    camera.lookAt(lookScratch.current);
  });

  return null;
}
