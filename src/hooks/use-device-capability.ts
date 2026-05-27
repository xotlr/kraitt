"use client";

import { useEffect, useState } from "react";

export type DeviceTier = "low" | "mid" | "high";

export type DeviceCapability = {
  tier: DeviceTier;
  reducedMotion: boolean;
  saveData: boolean;
};

type NavigatorExt = Navigator & {
  deviceMemory?: number;
  connection?: EventTarget & { saveData?: boolean };
};

const DEFAULT: DeviceCapability = {
  tier: "high",
  reducedMotion: false,
  saveData: false,
};

function detect(): DeviceCapability {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return DEFAULT;
  }
  const nav = navigator as NavigatorExt;
  const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
  const cores =
    typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;
  const saveData = nav.connection?.saveData === true;
  const reducedMotion =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  let tier: DeviceTier = "high";
  if ((memory !== undefined && memory <= 1) || (cores !== undefined && cores <= 1)) {
    tier = "low";
  } else if ((memory !== undefined && memory <= 2) || (cores !== undefined && cores <= 2)) {
    tier = "mid";
  }
  return { tier, reducedMotion, saveData };
}

export function useDeviceCapability(): DeviceCapability {
  const [cap, setCap] = useState<DeviceCapability>(DEFAULT);
  useEffect(() => {
    setCap(detect());
    if (typeof window === "undefined") return;
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onChange = () => setCap(detect());
    mql?.addEventListener?.("change", onChange);
    const conn = (navigator as NavigatorExt).connection;
    conn?.addEventListener?.("change", onChange);
    return () => {
      mql?.removeEventListener?.("change", onChange);
      conn?.removeEventListener?.("change", onChange);
    };
  }, []);
  return cap;
}
