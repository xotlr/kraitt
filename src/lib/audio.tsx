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

  // ── Transport (mobile Pro-Tools-style scrubber) ──────────────────────────
  /** Elapsed playback time in seconds, updated on the music element's
   *  timeupdate. 0 before the track has loaded/played. */
  currentTime: number;
  /** Track duration in seconds, 0 until metadata loads. */
  duration: number;
  /** Seek the music element to a 0..1 fraction of the track. No-op until the
   *  element exists (i.e. after the first play). */
  seek: (fraction: number) => void;
  /** Static peak amplitudes (0..1) sampled across the whole track, for drawing
   *  the transport waveform. Empty until the MP3 is decoded (lazy, on first
   *  play). The bars are the same for every render — a fixed print of the file,
   *  the way a DAW shows the clip's waveform. */
  waveform: number[];
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
  /** Honest programme loudness, 0..1, for the METERS (VU needle + clip).
   *
   *  This is deliberately NOT the bass/mid/high values. Those are *reactive*
   *  (energy above a rolling baseline) — tuned for the shader so a steady
   *  piano doesn't peg the terrain forever. A meter needs the opposite: it
   *  should read actual LOUDNESS, the way a real VU does. So `rms` is a true
   *  full-band RMS of the spectrum, SCALED BY THE FADER (post-fade metering),
   *  with proper ~300ms symmetric VU ballistics applied in the meter itself.
   *  Riding the fader down pulls the needle down — which is what "how the
   *  registry impacts the volume thing" should mean. */
  rms: number;
  /** Pre-ballistics peak of the post-fade signal, 0..1 — the clip latch
   *  watches this so "clip" means the signal actually pinned the ceiling. */
  peak: number;
  /** Honest per-band ENERGY for the EQ display, 0..1, post-fade.
   *
   *  Like `rms` but split into the three bands and WITHOUT the rolling-baseline
   *  subtraction that bass/mid/high carry. The reactive bass/mid/high collapse
   *  to ~0 once their ~5s baseline catches a sustained level — correct for the
   *  shader (a steady track shouldn't peg the terrain forever) but WRONG for an
   *  EQ, where it read as "bars start high, then sink to ~10% even at full
   *  volume". These stay up as long as the band is loud, so the EQ shows actual
   *  spectrum. PRE-fade — the EQ applies the fader itself as a visual ceiling,
   *  so these must not be fader-scaled (that would attenuate twice). */
  bassLevel: number;
  midLevel: number;
  highLevel: number;
};
const LevelsContext = createContext<{ current: LevelsRef } | null>(null);

const FFT_SIZE = 1024; // 512 usable bins; cheap, plenty for 3 bands
const ATTACK = 0.55; // 0..1 — higher = snappier on transients
const RELEASE = 0.08; // 0..1 — higher = faster decay back to 0
// Audio file path. Chopin, Nocturne in F minor Op. 55 No. 1 (perf. Luke
// Faulkner, via Musopen) — a CC0 / public-domain-dedicated recording, cleared
// for public deploy. The recording itself is PD, not just the composition.
// Provenance + license live in public/audio/LICENSE.json, which the
// tests/audio-license.spec.ts gate enforces. See also: CLAUDE.md "Pre-deploy
// checklist".
const MUSIC_SRC = "/audio/ambient.mp3";

export function AudioProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<globalThis.AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fftBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  // Time-domain (waveform) buffer — the METER reads loudness from this, not
  // from the FFT. getByteFrequencyData returns dB-domain bytes, which are
  // useless for an RMS loudness reading; the raw waveform samples are the
  // honest signal a VU integrates.
  const waveBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

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
  // Transport state for the mobile scrubber. currentTime/duration mirror the
  // music element; waveform is the decoded static peak print (computed once).
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const waveformDecodedRef = useRef(false);
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
  // Live fader value, mirrored for the metering tick so it can scale the RMS
  // by the set volume (post-fade metering) without re-subscribing the effect
  // on every fader move.
  const volumeRef = useRef(DEFAULT_VOLUME);
  volumeRef.current = volume;

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
      // Apply to the live element immediately; the fader's value is untouched
      // so the cap + fill stay put and un-mute restores that level. Read it
      // from volumeRef (not the `volume` state) so this callback's identity
      // stays stable — otherwise every fader tick rebuilds the context value
      // and re-renders every audio consumer.
      if (audioElRef.current) {
        audioElRef.current.volume = next ? 0 : volumeRef.current;
      }
      return next;
    });
  }, []);

  // Levels object shared by reference with the shader hook. We mutate
  // .bass/.mid/.high in place each frame; React does not re-render.
  const levelsRef = useRef<LevelsRef>({
    bass: 0,
    mid: 0,
    high: 0,
    pulse: 0,
    rms: 0,
    peak: 0,
    bassLevel: 0,
    midLevel: 0,
    highLevel: 0,
  });

  // Manual pluck — bumps the pulse counter the shader watches. useCallback
  // so its identity is stable in the context value.
  const triggerPulse = useCallback(() => {
    levelsRef.current.pulse += 1;
  }, []);

  // Seek to a 0..1 fraction of the track. The transport scrubber calls this on
  // drag/tap. No-op until the element exists (created on first play).
  const seek = useCallback((fraction: number) => {
    const el = audioElRef.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    const f = Math.max(0, Math.min(1, fraction));
    el.currentTime = f * el.duration;
    setCurrentTime(el.currentTime);
  }, []);

  // Decode the MP3 ONCE into a static waveform peak-print (like a DAW clip).
  // Lazy: fetched + decoded the first time music starts, so it costs nothing
  // until the user engages audio. We downsample the decoded PCM into BAR_COUNT
  // peak buckets (max-abs per bucket), normalised so the loudest bar is 1.0.
  const decodeWaveform = useCallback(async (ctx: globalThis.AudioContext) => {
    if (waveformDecodedRef.current) return;
    waveformDecodedRef.current = true;
    try {
      const res = await fetch(MUSIC_SRC);
      const buf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf);
      const ch = audioBuf.getChannelData(0); // mono is enough for a peak print
      const BAR_COUNT = 96;
      const block = Math.floor(ch.length / BAR_COUNT);
      const bars: number[] = [];
      let max = 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        let peak = 0;
        const start = i * block;
        for (let j = 0; j < block; j++) {
          const a = Math.abs(ch[start + j]);
          if (a > peak) peak = a;
        }
        bars.push(peak);
        if (peak > max) max = peak;
      }
      // Normalise to 0..1, then apply a gentle curve so quiet passages still
      // show some bar height (a raw linear peak print on compressed music looks
      // nearly flat). A floor keeps every bar visible as a tick.
      const norm = bars.map((b) => {
        const n = max > 0 ? b / max : 0;
        return Math.max(0.08, Math.pow(n, 0.7));
      });
      setWaveform(norm);
    } catch {
      // Decode failure (CORS, unsupported) — leave waveform empty; the
      // transport falls back to a flat baseline. Not fatal.
      waveformDecodedRef.current = false;
    }
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
    // The analyser is a metering TAP, never wired to destination. Each source
    // connects to it for analysis; only the MUSIC source also connects to
    // destination (so it's audible). The mic feeds the tap but not the
    // speakers — otherwise live input loops straight back as feedback.
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    fftBufRef.current = new Uint8Array(
      new ArrayBuffer(analyser.frequencyBinCount)
    );
    // Time-domain buffer is fftSize long (one sample per slot), not
    // frequencyBinCount (half that).
    waveBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
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
      el.volume = mutedRef.current ? 0 : volumeRef.current;
      // Transport wiring for the mobile scrubber: keep React's currentTime/
      // duration in step with the element. timeupdate fires ~4×/s during play
      // (cheap), loadedmetadata gives the duration once it's known.
      el.addEventListener("loadedmetadata", () => {
        if (isFinite(el.duration)) setDuration(el.duration);
      });
      el.addEventListener("timeupdate", () => {
        setCurrentTime(el.currentTime);
      });
      audioElRef.current = el;
      // Decode the static waveform print once, lazily, now that audio is live.
      void decodeWaveform(ctx);
      const src = ctx.createMediaElementSource(el);
      // Music graph: source -> destination (audible) and source -> analyser
      // (metering tap). The analyser is NOT chained to destination, so the
      // mic — which only feeds the tap — never reaches the speakers.
      src.connect(ctx.destination);
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

  // Tear the whole audio graph down when the provider unmounts: clear the
  // pending status timer, stop the mic stream's tracks (releases the OS
  // capture indicator), and close the AudioContext (frees the hardware
  // stream + the analyser). Matters in dev (strict-mode double-mount, HMR)
  // and any future route that unmounts the provider.
  useEffect(() => {
    return () => {
      if (statusResetTimerRef.current) {
        clearTimeout(statusResetTimerRef.current);
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
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
        // Meter signals ease back to rest on the slow VU fall so the needle
        // glides home rather than snapping — same ballistics as the rise.
        lv.rms *= 1 - 0.06;
        lv.peak = 0;
        // EQ bars fall back smoothly too.
        lv.bassLevel *= 1 - 0.12;
        lv.midLevel *= 1 - 0.12;
        lv.highLevel *= 1 - 0.12;
        if (
          lv.bass + lv.mid + lv.high + lv.rms +
            lv.bassLevel + lv.midLevel + lv.highLevel >
          0.001
        ) {
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    const analyser = analyserRef.current;
    const buf = fftBufRef.current;
    const wave = waveBufRef.current;
    if (!analyser || !buf || !wave) return;
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

    // VU ballistics. A real VU integrates with a ~300ms rise/fall — the
    // needle's mass averages the signal. At ~60fps a one-pole coefficient of
    // ~0.06 gives roughly that 300ms time constant, applied SYMMETRICALLY
    // (same up and down) the way a passive needle behaves. This is what makes
    // the meter read smooth programme LOUDNESS instead of jittering on every
    // frame. We integrate the post-fade RMS here so the value the meter reads
    // is already ballistically correct and the VU component just maps it to
    // an angle.
    const VU_COEFF = 0.06;
    let rmsBallistic = 0;

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

      // ── METER signal (honest loudness, post-fade) ──────────────────────
      // True RMS of the WAVEFORM, not the FFT. getByteTimeDomainData gives the
      // raw samples centred at 128; (s-128)/128 is the signal in -1..1. The
      // RMS of that is real loudness — the quantity a VU integrates. (The old
      // version RMS'd getByteFrequencyData, whose bytes are dB-domain magnitudes
      // spread across 512 mostly-empty bins, so a loud song still averaged to
      // near zero and the needle never left the floor. This is the fix.)
      analyser.getByteTimeDomainData(wave);
      let sumSq = 0;
      let peakSample = 0;
      for (let i = 0; i < wave.length; i++) {
        const s = (wave[i] - 128) / 128; // -1..1
        sumSq += s * s;
        const abs = s < 0 ? -s : s;
        if (abs > peakSample) peakSample = abs;
      }
      const rmsLinear = Math.sqrt(sumSq / wave.length); // 0..~1
      // Map linear RMS → meter throw. Real (compressed) music sits around
      // 0.1–0.2 linear RMS, so a flat ×2.6 left a loud track reading only ~30%.
      // We want a loud track up near the top. A gentle perceptual curve
      // (sqrt-ish via pow 0.7) lifts the low-mid range where music lives, then
      // a gain puts a typical loud passage at ~0.8–0.95 without instantly
      // pinning — quiet passages still sit low, so it's not just slammed to max.
      const rmsRaw = Math.min(1, Math.pow(rmsLinear, 0.7) * 3.0);
      const faderGain = mutedRef.current ? 0 : volumeRef.current;
      const rmsPostFade = rmsRaw * faderGain;
      // 300ms symmetric VU integration.
      rmsBallistic += (rmsPostFade - rmsBallistic) * VU_COEFF;
      const lvMeter = levelsRef.current;
      lvMeter.rms = rmsBallistic;
      // Instantaneous post-fade peak — clip latch watches this (no ballistics;
      // a clip is a peak event, the needle is the slow one).
      lvMeter.peak = Math.min(1, peakSample) * faderGain;

      // ── EQ band ENERGY (honest, PRE-fade, NO baseline) ─────────────────
      // The raw band averages (bass/mid/high above) are 0..1 spectral energy.
      // Gain them into a useful display range and lightly smooth (fast up,
      // slower down) so the bars track the music's spectrum and STAY up while
      // it's loud — unlike the reactive lv.bass/mid/high below, which sink to
      // baseline. These are PRE-fade: the EQ shows the source's spectrum, and
      // the EQ applies the fader separately as a visual CEILING (segments above
      // the set volume render disabled), so we must NOT also scale by the fader
      // here or the level would be attenuated twice. BAND_DISPLAY_GAIN spreads
      // quiet content up the column without pinning loud content.
      const BAND_DISPLAY_GAIN = 1.9;
      const targets = [
        Math.min(1, bass * BAND_DISPLAY_GAIN),
        Math.min(1, mid * BAND_DISPLAY_GAIN),
        Math.min(1, high * BAND_DISPLAY_GAIN),
      ];
      const cur = [lvMeter.bassLevel, lvMeter.midLevel, lvMeter.highLevel];
      for (let k = 0; k < 3; k++) {
        const t = targets[k];
        cur[k] += (t - cur[k]) * (t > cur[k] ? 0.5 : 0.12);
      }
      lvMeter.bassLevel = cur[0];
      lvMeter.midLevel = cur[1];
      lvMeter.highLevel = cur[2];

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
      currentTime,
      duration,
      seek,
      waveform,
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
      currentTime,
      duration,
      seek,
      waveform,
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
