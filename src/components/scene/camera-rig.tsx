"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useScrollViewport } from "@/lib/scroll-context";

/**
 * Scroll-driven camera. Reads progress from the ScrollArea viewport
 * (not window) and lerps the default camera between two poses:
 *
 *   Top (progress = 0):
 *     position (0, 0.4, 1.2), look at (0, 0, 0)
 *     camera is low and close to the front of the string field, looking
 *     slightly down at the strings near the front
 *
 *   Bottom (progress = 1):
 *     position (0, 2.5, 5.0), look at (0, 0, -2)
 *     camera has dollied back and risen, tilted up so the horizon rises
 *     and the field stretches into the distance
 *
 * The actual camera state is the smoothed value of `currentProgress`,
 * which trails `targetProgress` with a low-pass filter for buttery feel.
 *
 * Mounts inside the Canvas (so useThree/useFrame work). It doesn't
 * render anything — pure side-effect on the camera.
 */
const TOP_POS = new THREE.Vector3(0, 0.4, 1.2);
const BOTTOM_POS = new THREE.Vector3(0, 2.5, 5.0);
const TOP_LOOK = new THREE.Vector3(0, 0, 0);
const BOTTOM_LOOK = new THREE.Vector3(0, 0, -2);

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const viewportRef = useScrollViewport();

  const targetProgress = useRef(0);
  const currentProgress = useRef(0);
  // Reusable vectors so we don't allocate per frame.
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  useEffect(() => {
    const update = () => {
      const el = viewportRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      targetProgress.current = max > 0 ? el.scrollTop / max : 0;
    };
    // Defer one frame so the viewport ref is attached.
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
    // Low-pass filter so the camera feels weighted, not snappy.
    currentProgress.current +=
      (targetProgress.current - currentProgress.current) * 0.08;
    const p = currentProgress.current;

    // Ease the t-value so the early portion of the scroll has slightly
    // more camera motion (the dolly-back is the dramatic part, the
    // tilt continues into the deep page).
    const eased = 1 - Math.pow(1 - p, 1.7);

    pos.current.lerpVectors(TOP_POS, BOTTOM_POS, eased);
    look.current.lerpVectors(TOP_LOOK, BOTTOM_LOOK, eased);

    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}
