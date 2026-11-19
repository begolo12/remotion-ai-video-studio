import type { StyleId } from "../lib/plan/schema";
import { FONT } from "./fonts";

/**
 * Aturan aman 9:16 (diukur dari UI TikTok/Reels, nilai terketat dipakai):
 * - UI atas mencapai y=212 (Reels)
 * - kolom tombol kanan mulai x=927 dari y=803
 * - area caption platform mulai y=1726
 * Semua teks penting harus di dalam kotak ini.
 */
export const SAFE = {
  top: 212,
  bottom: 1726,
  left: 88,
  right: 900,
  /** Jarak blok caption dari tepi bawah (≈24% tinggi frame). */
  captionBottom: 452,
  captionWidth: 780,
  /** Area konten di atas caption. */
  contentBottom: 1380,
} as const;

export type Design = {
  id: StyleId;
  bgFrom: string;
  bgTo: string;
  blobs: [string, string, string];
  grid: string;
  gridOpacity: number;
  text: string;
  textMuted: string;
  accent: string;
  accent2: string;
  card: string;
  cardBorder: string;
  display: string;
  body: string;
  uppercase: boolean;
  tracking: string;
  radius: number;
  captionText: string;
  captionHighlight: string;
  captionOutline: string;
  grain: number;
  vignette: number;
  glow: number;
  gridOn: boolean;
  /** Teks di atas permukaan terang butuh bayangan gelap, bukan outline putih. */
  lightSurface: boolean;
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
};

/** `alpha("#22F5D9", 0.2)` → `rgba(34,245,217,0.2)` */
export const alpha = (hex: string, value: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, value))})`;
};

/** Warna teks yang tetap terbaca di atas `hex`. */
export const readableOn = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0b0b0f" : "#ffffff";
};

export const DESIGNS: Record<StyleId, Design> = {
  cinematic: {
    id: "cinematic",
    bgFrom: "#05070d",
    bgTo: "#111a2a",
    blobs: ["#F5B841", "#E2654E", "#2C4A6B"],
    grid: "#F5B841",
    gridOpacity: 0.05,
    text: "#F8F4EC",
    textMuted: "rgba(248,244,236,0.62)",
    accent: "#F5B841",
    accent2: "#E2654E",
    card: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(245,184,65,0.28)",
    display: FONT.serif,
    body: FONT.sans,
    uppercase: false,
    tracking: "-0.015em",
    radius: 26,
    captionText: "#FFFFFF",
    captionHighlight: "#F5B841",
    captionOutline: "rgba(5,7,13,0.92)",
    grain: 0.07,
    vignette: 0.55,
    glow: 0.55,
    gridOn: true,
    lightSurface: false,
  },
  neon: {
    id: "neon",
    bgFrom: "#05010c",
    bgTo: "#1b0433",
    blobs: ["#22F5D9", "#FF3D8A", "#7A5CFF"],
    grid: "#22F5D9",
    gridOpacity: 0.09,
    text: "#F4FBFF",
    textMuted: "rgba(244,251,255,0.6)",
    accent: "#22F5D9",
    accent2: "#FF3D8A",
    card: "rgba(34,245,217,0.07)",
    cardBorder: "rgba(34,245,217,0.35)",
    display: FONT.grotesk,
    body: FONT.sans,
    uppercase: true,
    tracking: "0.005em",
    radius: 18,
    captionText: "#FFFFFF",
    captionHighlight: "#22F5D9",
    captionOutline: "rgba(3,0,10,0.94)",
    grain: 0.03,
    vignette: 0.35,
    glow: 1,
    gridOn: true,
    lightSurface: false,
  },
  minimal: {
    id: "minimal",
    bgFrom: "#FBF9F5",
    bgTo: "#E9E3D8",
    blobs: ["#C15F3C", "#2F6F62", "#D9C7A7"],
    grid: "#14120F",
    gridOpacity: 0.035,
    text: "#14120F",
    textMuted: "rgba(20,18,15,0.6)",
    accent: "#C15F3C",
    accent2: "#2F6F62",
    card: "rgba(20,18,15,0.04)",
    cardBorder: "rgba(20,18,15,0.14)",
    display: FONT.sans,
    body: FONT.sans,
    uppercase: false,
    tracking: "-0.03em",
    radius: 22,
    captionText: "#14120F",
    captionHighlight: "#C15F3C",
    captionOutline: "rgba(251,249,245,0.95)",
    grain: 0.02,
    vignette: 0.12,
    glow: 0.3,
    gridOn: true,
    lightSurface: true,
  },
  bold: {
    id: "bold",
    bgFrom: "#FFD60A",
    bgTo: "#FF9E00",
    blobs: ["#FF3D00", "#FFFFFF", "#FFB703"],
    grid: "#0B0B0B",
    gridOpacity: 0.05,
    text: "#0B0B0B",
    textMuted: "rgba(11,11,11,0.62)",
    accent: "#D00000",
    accent2: "#0B0B0B",
    card: "rgba(11,11,11,0.07)",
    cardBorder: "rgba(11,11,11,0.18)",
    display: FONT.impact,
    body: FONT.sans,
    uppercase: true,
    tracking: "0.01em",
    radius: 14,
    captionText: "#0B0B0B",
    captionHighlight: "#D00000",
    captionOutline: "rgba(255,214,10,0.9)",
    grain: 0.03,
    vignette: 0.1,
    glow: 0.2,
    gridOn: false,
    lightSurface: true,
  },
  retro: {
    id: "retro",
    bgFrom: "#F8EAD3",
    bgTo: "#E0B784",
    blobs: ["#C8551D", "#3F6B52", "#F2D3A0"],
    grid: "#3D1F0F",
    gridOpacity: 0.045,
    text: "#3D1F0F",
    textMuted: "rgba(61,31,15,0.62)",
    accent: "#C8551D",
    accent2: "#3F6B52",
    card: "rgba(61,31,15,0.07)",
    cardBorder: "rgba(61,31,15,0.22)",
    display: FONT.serif,
    body: FONT.sans,
    uppercase: false,
    tracking: "-0.01em",
    radius: 32,
    captionText: "#3D1F0F",
    captionHighlight: "#C8551D",
    captionOutline: "rgba(248,234,211,0.92)",
    grain: 0.08,
    vignette: 0.3,
    glow: 0.25,
    gridOn: true,
    lightSurface: true,
  },
};

export const getDesign = (id: StyleId): Design => DESIGNS[id];

/** Anton hanya punya weight 400; font lain memakai 800. */
export const displayWeight = (design: Design): number =>
  design.id === "bold" ? 400 : 800;

/** Tinggi baris display: Anton butuh lebih rapat. */
export const displayLineHeight = (design: Design): number =>
  design.id === "bold" ? 0.94 : 1.02;
