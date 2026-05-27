"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { vineDefs } from "./anchors";
import { getVineUniforms, makeVineMaterial } from "./vine-material";

const TUBE_SEGMENTS = 360;
const RADIAL_SEGMENTS = 6;
const GOLD = new THREE.Color("#e9b56b");
const GOLD_EMISSIVE = new THREE.Color("#d49146");

export function Vines() {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  const totalHeight = viewport.height * 6;

  const tubes = useMemo(() => {
    return vineDefs.map((def) => {
      // Map normalized anchor space to world. y=1 anchors go to +halfH,
      // y=0 goes to -halfH so the curve's "top" sits at the top of the
      // tapestry band when the group is at rest.
      const halfH = totalHeight / 2;
      const points = def.anchors.map(
        ([x, y, z]) =>
          new THREE.Vector3(
            x * viewport.width * 0.5,
            (y - 0.5) * totalHeight,
            z
          )
      );
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        "catmullrom",
        0.5
      );
      const geom = new THREE.TubeGeometry(
        curve,
        TUBE_SEGMENTS,
        def.radius * Math.min(viewport.width, 4),
        RADIAL_SEGMENTS,
        false
      );
      const indexCount = geom.index ? geom.index.count : 0;
      geom.setDrawRange(0, 0);

      // Normalized vine-space y of the curve's endpoints, used by the
      // fragment shader to position the click-pulse wavefront.
      const ys = def.anchors.map((a) => a[1]);
      const vineY0 = Math.max(...ys);
      const vineY1 = Math.min(...ys);
      void halfH;

      const mat = makeVineMaterial({
        color: GOLD,
        emissive: GOLD_EMISSIVE,
        emissiveIntensity: def.glow * 0.9,
        metalness: 0.55,
        roughness: 0.28,
        breathPhase: def.breathPhase,
        breathDepth: def.breathDepth,
        tipTaper: 0.12,
        vineY0,
        vineY1,
      });

      return { def, geom, mat, indexCount, vineY0, vineY1 };
    });
  }, [viewport.width, viewport.height, totalHeight]);

  useEffect(() => {
    return () => {
      tubes.forEach(({ geom, mat }) => {
        geom.dispose();
        mat.dispose();
      });
    };
  }, [tubes]);

  const targetProgress = useRef(0);
  const currentProgress = useRef(0);
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseSmooth = useRef({ x: 0, y: 0 });
  const clickTime = useRef(-10);
  const clickY = useRef(0.5);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      targetProgress.current = max > 0 ? window.scrollY / max : 0;
    };
    const onMove = (e: PointerEvent) => {
      mouseTarget.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onClick = (e: PointerEvent) => {
      // Convert click y to vine-space normalized y. Click is in viewport
      // coords; vine-space y=1 is the *current* top of visible tapestry
      // (determined by scroll progress + group offset).
      //
      // Cheap approximation: map clientY to 0..1 vine-y by inverting
      // clientY/innerHeight and adding scroll progress so y stays
      // correct as the user moves down the page.
      const viewportY = 1 - e.clientY / window.innerHeight;
      // current progress shifts the tapestry, so the click's vine-y is
      // (viewportY + progress*5) / 6 roughly — but for the pulse to
      // "fire from where the user clicked on screen" we want
      // *screen-space* y, not document space. Keep it simple: pulse
      // emanates from the click point in screen-space and the wave
      // crosses the visible tapestry section, so just use viewportY
      // mapped into a wider domain.
      clickY.current = viewportY;
      // also bump clickTime to "now" in clock seconds (we'll grab
      // clock.elapsedTime from useFrame and stamp it).
      pendingClick.current = true;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
    };
  }, []);

  const pendingClick = useRef(false);

  useFrame(({ clock }) => {
    currentProgress.current +=
      (targetProgress.current - currentProgress.current) * 0.08;
    mouseSmooth.current.x +=
      (mouseTarget.current.x - mouseSmooth.current.x) * 0.06;
    mouseSmooth.current.y +=
      (mouseTarget.current.y - mouseSmooth.current.y) * 0.06;

    if (pendingClick.current) {
      clickTime.current = clock.elapsedTime;
      pendingClick.current = false;
    }

    const p = currentProgress.current;
    const t = clock.elapsedTime;

    tubes.forEach(({ def, geom, mat, indexCount }) => {
      const local = Math.max(
        0,
        Math.min(1, (p - def.growStart) / (1 - def.growStart))
      );
      const eased = 1 - Math.pow(1 - local, 1.6);
      const growEnd = 0.18 + eased * 0.82;
      const count = Math.floor(growEnd * indexCount);
      geom.setDrawRange(0, count);

      const u = getVineUniforms(mat);
      u.uTime.value = t;
      u.uGrowEnd.value = growEnd;
      u.uClickTime.value = clickTime.current;
      u.uClickY.value = clickY.current;
    });

    if (groupRef.current) {
      const targetRx = mouseSmooth.current.y * 0.05;
      const targetRy = mouseSmooth.current.x * 0.07;
      groupRef.current.rotation.x +=
        (targetRx - groupRef.current.rotation.x) * 0.1;
      groupRef.current.rotation.y +=
        (targetRy - groupRef.current.rotation.y) * 0.1;
    }
  });

  useFrame(() => {
    if (!groupRef.current) return;
    const p = currentProgress.current;
    const halfH = totalHeight / 2;
    const viewHalf = viewport.height / 2;
    const startY = -(halfH - viewHalf);
    const endY = halfH - viewHalf;
    groupRef.current.position.y = startY + (endY - startY) * p;
  });

  return (
    <group ref={groupRef}>
      {tubes.map((t, i) => (
        <mesh
          key={i}
          geometry={t.geom}
          material={t.mat}
          position={[0, 0, t.def.glow > 1 ? 0.05 : t.def.glow > 0.7 ? 0 : -0.2]}
        />
      ))}
    </group>
  );
}
