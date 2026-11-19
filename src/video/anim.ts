import { Easing, interpolate, spring } from "remotion";

/**
 * Helper animasi murni: semua nilai hanya bergantung pada `frame`
 * (deterministik, tanpa hook React, aman dipakai di dalam render Remotion).
 */

/** Batasi nilai ke rentang 0..1. NaN / Infinity dianggap 0. */
export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export type FadeUpStyle = {
  opacity: number;
  transform: string;
};

/**
 * Fade masuk sambil bergeser naik `distancePx`.
 * `delayFrames` dipakai untuk stagger antar elemen.
 */
export const fadeUp = (
  frame: number,
  fps: number,
  delayFrames = 0,
  distancePx = 32,
): FadeUpStyle => {
  const duration = Math.max(1, Math.round(fps * 0.42));
  const opacity = clamp01(
    interpolate(frame - delayFrames, [0, duration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );

  return {
    opacity,
    transform: `translateY(${((1 - opacity) * distancePx).toFixed(2)}px)`,
  };
};

export type SpringInStyle = {
  scale: number;
  opacity: number;
};

/** Skala 0.9 → 1 dengan pegas yang tidak memantul, plus fade singkat. */
export const springIn = (
  frame: number,
  fps: number,
  delayFrames = 0,
): SpringInStyle => {
  const localFrame = Math.max(0, frame - delayFrames);
  const progress = clamp01(
    spring({
      frame: localFrame,
      fps,
      config: { damping: 200, mass: 0.6, stiffness: 110 },
    }),
  );

  return {
    scale: 0.9 + 0.1 * progress,
    opacity: clamp01(progress * 1.6),
  };
};

/** Potongan teks yang sudah "diketik" pada frame ini. */
export const typewriter = (
  text: string,
  frame: number,
  fps: number,
  charsPerSecond = 24,
): string => {
  const source = text ?? "";
  const rate = Math.max(1, charsPerSecond);
  const elapsedSeconds = Math.max(0, frame) / Math.max(1, fps);
  const visible = Math.floor(elapsedSeconds * rate);

  return source.slice(0, Math.min(source.length, Math.max(0, visible)));
};

/** Zoom halus 1 → 1.06 sepanjang durasi scene. */
export const kenBurns = (frame: number, durationInFrames: number): number =>
  interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * Opacity keluar: tetap 1 sampai `exitFrames` terakhir, lalu turun ke 0
 * di frame terakhir supaya transisi antar scene tidak menghentak.
 */
export const exitFade = (
  frame: number,
  durationInFrames: number,
  exitFrames = 12,
): number => {
  const total = Math.max(1, durationInFrames);
  const fade = Math.max(1, Math.min(exitFrames, Math.floor(total / 3)));
  const start = Math.max(0, total - fade);

  return clamp01(
    interpolate(frame, [start, total], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
};

/** Fade masuk singkat di awal scene (dipakai bersama `exitFade`). */
export const enterFade = (
  frame: number,
  durationInFrames: number,
  enterFrames = 10,
): number => {
  const total = Math.max(1, durationInFrames);
  const fade = Math.max(1, Math.min(enterFrames, Math.floor(total / 3)));
  return clamp01(
    interpolate(frame, [0, fade], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
};

export type CameraState = {
  scale: number;
  x: number;
  y: number;
  rotate: number;
};

/**
 * Gerak kamera kontinu. Aturan dari riset motion:
 * - kecepatan tidak boleh berhenti di akhir (blend linear ~0.35),
 * - arah tetap monotonic supaya tidak terlihat "goyang",
 * - beberapa scene memakai arah berbeda agar cut terasa disengaja.
 */
export const cameraMove = (
  frame: number,
  durationInFrames: number,
  seed = 0,
  strength = 1,
): CameraState => {
  const total = Math.max(2, durationInFrames - 1);
  const t = clamp01(frame / total);
  const tail = 0.34;
  const eased = (1 - tail) * easeInOutCubic(t) + tail * t;

  const variant = Math.abs(seed) % 3;
  const zoomIn = variant !== 1;
  const scale = zoomIn ? 1 + 0.07 * eased * strength : 1.07 - 0.06 * eased * strength;
  const direction = variant === 2 ? -1 : 1;

  return {
    scale,
    x: direction * 16 * eased * strength,
    y: (variant === 1 ? 1 : -0.6) * 14 * eased * strength,
    rotate: 0,
  };
};

/** Angka menghitung naik dari 0 ke `value` (untuk statistik). */
export const countUp = (value: number, frame: number, fps: number, delayFrames = 0): number => {
  const progress = clamp01(
    spring({
      frame: Math.max(0, frame - delayFrames),
      fps,
      config: { damping: 200, mass: 1, stiffness: 60 },
    }),
  );
  return value * progress;
};

/** Pecah kalimat menjadi kata (tanpa menghapus tanda baca). */
export const words = (text: string): string[] =>
  (text ?? "").trim().split(/\s+/).filter(Boolean);

export type WordReveal = {
  text: string;
  opacity: number;
  translateY: number;
  scale: number;
};

/** Reveal per kata dengan stagger; dipakai headline agar terasa "kinetic". */
export const revealWords = (
  text: string,
  frame: number,
  fps: number,
  delayFrames = 0,
  staggerFrames = 3,
): WordReveal[] => {
  return words(text).map((word, index) => {
    const local = frame - delayFrames - index * staggerFrames;
    const progress = clamp01(
      spring({
        frame: Math.max(0, local),
        fps,
        config: { damping: 200, mass: 0.55, stiffness: 130 },
      }),
    );
    return {
      text: word,
      opacity: clamp01(progress * 1.8),
      translateY: (1 - progress) * 34,
      scale: 0.94 + 0.06 * progress,
    };
  });
};
