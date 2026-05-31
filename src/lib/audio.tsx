"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Audio plumbing: one AudioContext, one shared AnalyserNode reading FFT
 * from whichever source is currently active (music or mic). Consumers
 * (the shader) read the smoothed bass/mid/high bands via useAudioLevels().
 *
 * Why one context, one analyser: browsers permit ~6 AudioContexts max
 * and creating/tearing them on toggle is expensive. We just route the
 * source switch into the same graph: source -> analyser -> destination
 * (or just analyser, for mic — we don't want to play mic back).
 *
 * Levels are read on every animation frame from the analyser's frequency
 * data, split into three bands, and one-pole-filtered for smoothness.
 * The filter has separate attack/release so transients pop fast but
 * decay slowly — matches how musical content feels.
 */

export type MusicStatus = "idle" | "playing" | "unavailable";

type AudioState = {
  musicOn: boolean;
  micOn: boolean;
  musicStatus: MusicStatus;
  /** 0..1, applied to the music element's volume. Not mic. */
  volume: number;
  setVolume: (v: number) => void;
  /** Master mute. Independent of the fader (a real desk's mute kills output
   *  without moving the fader, and un-mute restores the set level). When
   *  muted the music element is silenced but `volume` keeps its value so the
   *  fader cap + fill stay where the user left them. */
  muted: boolean;
  toggleMute: () => void;
  toggleMusic: () => Promise<void>;
  toggleMic: () => Promise<void>;
  /** Fire a one-shot manual "pluck" — the console buttons call this so a
   *  click ripples the wave field when no audio source is playing. The
   *  shader watches LevelsRef.pulse (a counter) and launches a radial
   *  ring each time it increments. */
  triggerPulse: () => void;
};

const VOLUME_STORAGE_KEY = "sk:volume";
const DEFAULT_VOLUME = 0.5;

const AudioContext = createContext<AudioState | null>(null);

// Levels are exposed via a ref-like getter so the shader can read them
// every frame without re-rendering React on every audio frame.
type LevelsRef = {
  bass: number;
  mid: number;
  high: number;
  /** Monotonic counter — incremented by triggerPulse(). The shader
   *  remembers the last value it saw and fires a manual ripple whenever
   *  it changes. */
  pulse: number;
};
const LevelsContext = createContext<{ current: LevelsRef } | null>(null);

const FFT_SIZE = 1024; // 512 usable bins; cheap, plenty for 3 bands
const ATTACK = 0.55; // 0..1 — higher = snappier on transients
const RELEASE = 0.08; // 0..1 — higher = faster decay back to 0
// Audio file path. Currently expected to be "Une Vie à t'Aimer" from
// the Clair Obscur: Expedition 33 OST — used as a DEVELOPMENT-ONLY
// placeholder. This file is © Sandfall Interactive / Lorien Testard
// and is NOT licensed for redistribution. Before any public deploy:
// replace with a track that is either public domain or properly
// licensed. See also: CLAUDE.md "Pre-deploy checklist".
const MUSIC_SRC = "/audio/ambient.mp3";

export function AudioProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<globalThis.AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fftBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Music graph
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const musicSrcRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Mic graph
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const [musicOn, setMusicOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [musicStatus, setMusicStatus] = useState<MusicStatus>("idle");
  const [volume, setVolumeState] = useState<number>(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const statusResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Hydrate volume from localStorage. SSR-safe — runs in effect, so
  // server renders with the default and client patches it up.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      if (stored !== null) {
        const v = parseFloat(stored);
        if (!Number.isNaN(v) && v >= 0 && v <= 1) {
          setVolumeState(v);
        }
      }
    } catch {
      // localStorage may be unavailable (private mode, etc.) — fall
      // through with the default.
    }
  }, []);

  // Live mute state read inside setVolume without re-creating the callback
  // (so its identity stays stable in the context value).
  const mutedRef = useRef(false);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    // Moving the fader off zero implicitly un-mutes — you grabbed the fader,
    // you want sound. Matches how a desk behaves: riding the fader overrides
    // a mute. (Setting it TO zero leaves mute as-is.)
    if (clamped > 0 && mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
    }
    if (audioElRef.current) {
      audioElRef.current.volume = mutedRef.current ? 0 : clamped;
    }
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // ignore storage failures
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      // Apply to the live element immediately; the fader's `volume` value is
      // untouched so the cap + fill stay put and un-mute restores that level.
      if (audioElRef.current) {
        audioElRef.current.volume = next ? 0 : volume;
      }
      return next;
    });
  }, [volume]);

  // Levels object shared by reference with the shader hook. We mutate
  // .bass/.mid/.high in place each frame; React does not re-render.
  const levelsRef = useRef<LevelsRef>({ bass: 0, mid: 0, high: 0, pulse: 0 });

  // Manual pluck — bumps the pulse counter the shader watches. useCallback
  // so its identity is stable in the context value.
  const triggerPulse = useCallback(() => {
    levelsRef.current.pulse += 1;
  }, []);

  // Lazily build the shared graph on first toggle. Browsers require a
  // user gesture before resume(), so we don't construct anything until
  // the user clicks one of the buttons.
  const ensureContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.5;
    analyser.connect(ctx.destination); // music plays through; mic graph won't connect through here.
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    fftBufRef.current = new Uint8Array(
      new ArrayBuffer(analyser.frequencyBinCount)
    );
    return ctx;
  }, []);

  const toggleMusic = useCallback(async () => {
    const ctx = ensureContext();
    if (ctx.state === "suspended") await ctx.resume();

    if (!audioElRef.current) {
      const el = new Audio(MUSIC_SRC);
      el.loop = true;
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.volume = mutedRef.current ? 0 : volume;
      audioElRef.current = el;
      const src = ctx.createMediaElementSource(el);
      // Music graph: source -> analyser -> destination
      src.connect(analyserRef.current!);
      musicSrcRef.current = src;
    }
    const el = audioElRef.current;
    if (el.paused) {
      try {
        await el.play();
        setMusicOn(true);
        setMusicStatus("playing");
      } catch (err) {
        // Missing file (404) or autoplay block. Surface as a UI state
        // so the user sees "Audio unavailable" instead of a silently
        // dead button.
        // Failure is surfaced to the UI via musicStatus = "unavailable",
        // no need to log. Common causes: missing file, autoplay block.
        void err;
        setMusicOn(false);
        setMusicStatus("unavailable");
        if (statusResetTimerRef.current) {
          clearTimeout(statusResetTimerRef.current);
        }
        statusResetTimerRef.current = setTimeout(() => {
          setMusicStatus("idle");
        }, 2400);
      }
    } else {
      el.pause();
      setMusicOn(false);
      setMusicStatus("idle");
    }
  }, [ensureContext]);

  const toggleMic = useCallback(async () => {
    const ctx = ensureContext();
    if (ctx.state === "suspended") await ctx.resume();

    if (micOn) {
      // Tear down
      micSrcRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micSrcRef.current = null;
      micStreamRef.current = null;
      setMicOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
      });
      micStreamRef.current = stream;
      const src = ctx.createMediaStreamSource(stream);
      // Mic graph: source -> analyser only (NOT to destination — don't
      // play the mic back to the speakers, that's feedback).
      src.connect(analyserRef.current!);
      micSrcRef.current = src;
      setMicOn(true);
    } catch (err) {
      // Permission denied or device unavailable. Silent — the toggle
      // simply stays off. Could surface a UI hint later if needed.
      void err;
    }
  }, [ensureContext, micOn]);

  // Clear any pending status-reset timer when provider unmounts.
  useEffect(() => {
    return () => {
      if (statusResetTimerRef.current) {
        clearTimeout(statusResetTimerRef.current);
      }
    };
  }, []);

  // Per-frame level extraction. Runs as long as either source is on.
  useEffect(() => {
    if (!musicOn && !micOn) {
      // Decay to zero when nothing is playing.
      let raf = 0;
      const tick = () => {
        const lv = levelsRef.current;
        lv.bass *= 1 - RELEASE;
        lv.mid *= 1 - RELEASE;
        lv.high *= 1 - RELEASE;
        if (lv.bass + lv.mid + lv.high > 0.001) {
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    const analyser = analyserRef.current;
    const buf = fftBufRef.current;
    if (!analyser || !buf) return;
    let raf = 0;
    const sampleRate = ctxRef.current?.sampleRate ?? 48000;
    const nyquist = sampleRate / 2;
    const binHz = nyquist / analyser.frequencyBinCount;
    // Band edges in Hz
    const bassEnd = 200;
    const midEnd = 2000;
    const bassEndBin = Math.floor(bassEnd / binHz);
    const midEndBin = Math.floor(midEnd / binHz);

    // Slow-moving baselines (one-pole IIR with very slow time constant).
    // We subtract these from instant readings so the level only spikes
    // ABOVE the local average — that's what correlates with a beat hit
    // rather than constant loudness. Without this, music with steady
    // energy (e.g. piano ballads) reads as 0.8 bass forever and the
    // visual never animates.
    const baselines = { bass: 0, mid: 0, high: 0 };
    const BASELINE_COEFF = 0.008; // ~5s time constant at 60fps

    const tick = () => {
      analyser.getByteFrequencyData(buf);
      let bSum = 0,
        mSum = 0,
        hSum = 0;
      let bN = 0,
        mN = 0,
        hN = 0;
      for (let i = 1; i < buf.length; i++) {
        const v = buf[i] / 255;
        if (i <= bassEndBin) {
          bSum += v;
          bN++;
        } else if (i <= midEndBin) {
          mSum += v;
          mN++;
        } else {
          hSum += v;
          hN++;
        }
      }
      const bass = bN ? bSum / bN : 0;
      const mid = mN ? mSum / mN : 0;
      const high = hN ? hSum / hN : 0;

      // Update baselines toward instant.
      baselines.bass += (bass - baselines.bass) * BASELINE_COEFF;
      baselines.mid += (mid - baselines.mid) * BASELINE_COEFF;
      baselines.high += (high - baselines.high) * BASELINE_COEFF;

      // Reactive value = how far the instant reading is above its own
      // slow baseline. Clamped 0..1 and scaled — beat hits push it to
      // ~0.8-1.0, sustained sound sits near 0.
      const BAND_GAIN = 6.0;
      const reactiveBass = Math.max(0, Math.min(1, (bass - baselines.bass) * BAND_GAIN));
      const reactiveMid = Math.max(0, Math.min(1, (mid - baselines.mid) * BAND_GAIN));
      const reactiveHigh = Math.max(0, Math.min(1, (high - baselines.high) * BAND_GAIN));

      const lv = levelsRef.current;
      // Asymmetric one-pole: snap up fast, decay slow.
      lv.bass =
        reactiveBass > lv.bass
          ? lv.bass + (reactiveBass - lv.bass) * ATTACK
          : lv.bass + (reactiveBass - lv.bass) * RELEASE;
      lv.mid =
        reactiveMid > lv.mid
          ? lv.mid + (reactiveMid - lv.mid) * ATTACK
          : lv.mid + (reactiveMid - lv.mid) * RELEASE;
      lv.high =
        reactiveHigh > lv.high
          ? lv.high + (reactiveHigh - lv.high) * ATTACK
          : lv.high + (reactiveHigh - lv.high) * RELEASE;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [musicOn, micOn]);

  const state: AudioState = useMemo(
    () => ({
      musicOn,
      micOn,
      musicStatus,
      volume,
      setVolume,
      muted,
      toggleMute,
      toggleMusic,
      toggleMic,
      triggerPulse,
    }),
    [
      musicOn,
      micOn,
      musicStatus,
      volume,
      setVolume,
      muted,
      toggleMute,
      toggleMusic,
      toggleMic,
      triggerPulse,
    ]
  );
  const levelsValue = useMemo(() => ({ current: levelsRef.current }), []);

  return (
    <AudioContext.Provider value={state}>
      <LevelsContext.Provider value={levelsValue}>
        {children}
      </LevelsContext.Provider>
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioState {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used inside AudioProvider");
  return ctx;
}

/**
 * Returns a ref-style object whose `.current` is mutated each frame
 * with the latest smoothed levels. Read it inside useFrame — do NOT
 * destructure outside the frame loop, you'll get a snapshot value.
 */
export function useAudioLevels(): { current: LevelsRef } {
  const ctx = useContext(LevelsContext);
  if (!ctx)
    throw new Error("useAudioLevels must be used inside AudioProvider");
  return ctx;
}
