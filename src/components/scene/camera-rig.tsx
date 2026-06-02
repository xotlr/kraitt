"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useScrollProgress } from "@/lib/scroll-context";

/**
 * Scroll-driven camera zoom. As the user scrolls DOWN the page, the
 * camera pulls BACK and rises — zooming out so the whole landscape
 * recedes into view. Scrolling back UP flies the camera back in to
 * the original close-up position. The motion is fully reversible and
 * scroll-linked: any scroll position maps to one camera state, so
 * up/down retrace the same path. Reads scroll from the ScrollArea
 * viewport via the same context the rest of the scroll-linked code uses.
 *
 * Path:
 *   scroll = 0 (top):    (0, 0.8, 3.5)  looking at (0, -0.2, -2.5)  — zoomed in
 *   scroll = 1 (bottom): (0, 3.4, 9.5)  looking at (0, -0.4, -2.5)  — zoomed out
 *
 * Camera retreats ~6 wu along +Z and rises ~2.6 wu over the full page
 * scroll, keeping the same lookAt target so it dollies straight back
 * (a true zoom-out) rather than pivoting.
 */
const TOP_POS = new THREE.Vector3(0, 0.8, 3.5);
const BOTTOM_POS = new THREE.Vector3(0, 3.4, 9.5);
const TOP_LOOK = new THREE.Vector3(0, -0.2, -2.5);
const BOTTOM_LOOK = new THREE.Vector3(0, -0.4, -2.5);

export function CameraRig() {
  const camera = useThree((s) => s.camera);

  // Live scroll progress (0..1), read in useFrame without re-rendering.
  const targetProgress = useScrollProgress();
  const currentProgress = useRef(0);
  const posScratch = useRef(new THREE.Vector3());
  const lookScratch = useRef(new THREE.Vector3());

  useFrame(() => {
    // Low-pass smooth so scroll doesn't snap the camera.
    currentProgress.current +=
      (targetProgress.current - currentProgress.current) * 0.08;
    const p = currentProgress.current;
    // Gentle ease-out so the pull-back decelerates near the far end
    // instead of snapping; the early scroll still reads as motion.
    const eased = 1 - Math.pow(1 - p, 1.3);

    posScratch.current.lerpVectors(TOP_POS, BOTTOM_POS, eased);
    lookScratch.current.lerpVectors(TOP_LOOK, BOTTOM_LOOK, eased);
    camera.position.copy(posScratch.current);
    camera.lookAt(lookScratch.current);
  });

  return null;
}
