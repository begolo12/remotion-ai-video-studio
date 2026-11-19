import type { StyleId } from "./schema";

export type StyleTokens = {
  id: StyleId;
  label: string;
  description: string;
  /** Latar belakang penuh (CSS). */
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  fontDisplay: string;
  fontBody: string;
  uppercase: boolean;
  radius: number;
  /** Efek dekoratif yang dipakai komponen Remotion. */
  vignette: boolean;
  glow: boolean;
  grain: boolean;
  /** Warna garis/aksen tipis. */
  line: string;
};

export const STYLE_TOKENS: Record<StyleId, StyleTokens> = {
  cinematic: {
    id: "cinematic",
    label: "Cinematic",
    description: "Gelap, sinematik, aksen amber, tipografi serif tebal.",
    background:
      "radial-gradient(120% 90% at 20% 0%, #1b2333 0%, #0b0e16 55%, #05060a 100%)",
    surface: "rgba(255,255,255,0.06)",
    text: "#f4f1ea",
    muted: "rgba(244,241,234,0.62)",
    accent: "#f0b429",
    accent2: "#e26d5c",
    fontDisplay: "Georgia, 'Times New Roman', serif",
    fontBody: "'Segoe UI', system-ui, sans-serif",
    uppercase: false,
    radius: 28,
    vignette: true,
    glow: false,
    grain: true,
    line: "rgba(240,180,41,0.45)",
  },
  neon: {
    id: "neon",
    label: "Neon Cyber",
    description: "Hitam-ungu, glow cyan/magenta, tipografi tegas.",
    background:
      "radial-gradient(100% 80% at 80% 10%, #2a0a4a 0%, #12021f 45%, #05010a 100%)",
    surface: "rgba(0,255,247,0.07)",
    text: "#f2f7ff",
    muted: "rgba(242,247,255,0.6)",
    accent: "#00f5d4",
    accent2: "#ff2e88",
    fontDisplay: "'Segoe UI', system-ui, sans-serif",
    fontBody: "'Segoe UI', system-ui, sans-serif",
    uppercase: true,
    radius: 18,
    vignette: false,
    glow: true,
    grain: false,
    line: "rgba(0,245,212,0.5)",
  },
  minimal: {
    id: "minimal",
    label: "Clean Minimal",
    description: "Terang, bersih, aksen terakota, banyak ruang kosong.",
    background: "linear-gradient(180deg, #faf8f4 0%, #efece5 100%)",
    surface: "rgba(17,17,17,0.04)",
    text: "#12110f",
    muted: "rgba(18,17,15,0.58)",
    accent: "#c15f3c",
    accent2: "#2f6f62",
    fontDisplay: "'Segoe UI', system-ui, sans-serif",
    fontBody: "'Segoe UI', system-ui, sans-serif",
    uppercase: false,
    radius: 22,
    vignette: false,
    glow: false,
    grain: false,
    line: "rgba(18,17,15,0.16)",
  },
  bold: {
    id: "bold",
    label: "Bold Punch",
    description: "Kuning menyala, teks hitam besar, energi tinggi.",
    background: "linear-gradient(160deg, #ffd60a 0%, #ffb703 60%, #f77f00 100%)",
    surface: "rgba(0,0,0,0.08)",
    text: "#0d0d0d",
    muted: "rgba(13,13,13,0.62)",
    accent: "#d00000",
    accent2: "#0d0d0d",
    fontDisplay: "'Segoe UI', system-ui, sans-serif",
    fontBody: "'Segoe UI', system-ui, sans-serif",
    uppercase: true,
    radius: 14,
    vignette: false,
    glow: false,
    grain: false,
    line: "rgba(13,13,13,0.28)",
  },
  retro: {
    id: "retro",
    label: "Retro 70s",
    description: "Krem-oranye, serif klasik, nuansa poster lawas.",
    background: "linear-gradient(180deg, #f6e8d5 0%, #e8c9a0 100%)",
    surface: "rgba(92,48,22,0.08)",
    text: "#3d1f0f",
    muted: "rgba(61,31,15,0.6)",
    accent: "#c8551d",
    accent2: "#3f6b52",
    fontDisplay: "Georgia, 'Times New Roman', serif",
    fontBody: "Georgia, 'Times New Roman', serif",
    uppercase: false,
    radius: 34,
    vignette: true,
    glow: false,
    grain: true,
    line: "rgba(61,31,15,0.25)",
  },
};

export const STYLE_LIST = Object.values(STYLE_TOKENS);

export const getStyleTokens = (id: StyleId): StyleTokens => STYLE_TOKENS[id];
