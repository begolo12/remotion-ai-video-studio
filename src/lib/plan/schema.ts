import { z } from "zod";

/**
 * Kontrak data antara AI, API, Remotion, dan UI.
 * Semua bagian video (kecuali visual) berasal dari sini.
 */

export const STYLE_IDS = ["cinematic", "neon", "minimal", "bold", "retro"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const SCENE_TEMPLATES = [
  "hook",
  "bullets",
  "stat",
  "quote",
  "statement",
  "outro",
] as const;
export type SceneTemplate = (typeof SCENE_TEMPLATES)[number];

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const MIN_SECONDS = 15;
export const MAX_SECONDS = 180;

/** Objek ilustrasi SVG yang tersedia; AI memilih yang paling cocok per scene. */
export const VISUAL_KINDS = [
  "vehicle",
  "container",
  "factory",
  "ship",
  "globe",
  "pipeline",
  "chart",
  "phone",
  "person",
  "house",
  "mountain",
  "lab",
  "money",
  "food",
  "network",
  "finale",
] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];

export type CaptionWord = {
  /** Teks kata (sudah termasuk tanda baca). */
  t: string;
  /** Detik relatif terhadap awal scene. */
  s: number;
  /** Detik akhir kata. */
  e: number;
};

export const sceneSchema = z.object({
  template: z.enum(SCENE_TEMPLATES),
  /** Ilustrasi utama scene (gaya explainer SVG, bukan slide teks). */
  visual: z.enum(VISUAL_KINDS).optional(),
  /** Bab yang berisi beberapa scene, mis. "DARI KILANG KE MOTORMU". */
  chapter: z.string().trim().max(60).optional(),
  /** Sub-bab, mis. "Perjalanan". */
  chapterSub: z.string().trim().max(60).optional(),
  /** Kata kunci yang disorot kuning di label bab. */
  keyword: z.string().trim().max(30).optional(),
  /** Label kecil di atas objek ilustrasi, mis. "tangki", "kapal". */
  callouts: z.array(z.string().trim().min(1).max(30)).max(3).optional(),
  /** Judul utama scene (maks 90 karakter agar tetap terbaca di layar 9:16). */
  heading: z.string().trim().min(1).max(90).optional(),
  subheading: z.string().trim().max(140).optional(),
  bullets: z.array(z.string().trim().min(1).max(80)).min(1).max(5).optional(),
  /** Angka besar untuk template "stat", mis. "82%" atau "3x". */
  value: z.string().trim().max(12).optional(),
  label: z.string().trim().max(60).optional(),
  quote: z.string().trim().max(180).optional(),
  author: z.string().trim().max(60).optional(),
  text: z.string().trim().max(220).optional(),
  /** Bobot durasi relatif terhadap scene lain. */
  weight: z.number().min(0.4).max(3).optional(),
  /** Teks narasi/voice over untuk scene ini (ditampilkan di UI, tidak dirender). */
  narration: z.string().trim().max(300).optional(),
  /** Hasil sintesis suara narasi; diisi server, bukan oleh AI. */
  audio: z
    .object({
      src: z.string().trim().min(1),
      seconds: z.number().min(0.2).max(120),
    })
    .optional(),
  /** Timing kata hasil word-boundary TTS; dipakai caption karaoke ala referensi. */
  words: z
    .array(
      z.object({
        t: z.string().trim().min(1).max(40),
        s: z.number().min(0).max(120),
        e: z.number().min(0).max(120),
      }),
    )
    .max(120)
    .optional(),
});

export type Scene = z.infer<typeof sceneSchema>;

export const planSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(100),
  hook: z.string().trim().min(1).max(120),
  styleId: z.enum(STYLE_IDS),
  targetSeconds: z.number().min(MIN_SECONDS).max(MAX_SECONDS),
  scenes: z.array(sceneSchema).min(1).max(16),
  outro: z.object({
    heading: z.string().trim().min(1).max(90),
    cta: z.string().trim().min(1).max(120),
  }),
  caption: z.string().trim().min(1).max(1200),
  hashtags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  narration: z.array(z.string().trim().max(300)).default([]),
  musicMood: z.string().trim().max(60).optional(),
  /** Path musik latar di public/ (opsional, diisi server bila tersedia). */
  music: z.string().trim().max(200).optional(),
});

export type VideoPlan = z.infer<typeof planSchema>;

export const generateRequestSchema = z.object({
  description: z.string().trim().min(10, "Deskripsi minimal 10 karakter").max(2000),
  targetSeconds: z.number().int().min(MIN_SECONDS).max(MAX_SECONDS),
  styleId: z.enum(STYLE_IDS),
  model: z.string().trim().min(1).max(120).optional(),
  /** Suara narasi; `false` untuk video tanpa suara. */
  voice: z.enum(["male", "female"]).optional(),
  withNarration: z.boolean().optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const renderRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(120),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

export type ProjectRender = {
  id: string;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  url?: string;
  file?: string;
  message?: string;
  createdAt: string;
  finishedAt?: string;
};

export type Project = {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: {
    description: string;
    targetSeconds: number;
    styleId: StyleId;
    model?: string;
  };
  plan: VideoPlan;
  model: string;
  fellBack: boolean;
  narration?: {
    enabled: boolean;
    voice: string;
    scenes: number;
    totalSeconds: number;
    error?: string;
  };
  renders: ProjectRender[];
};

export type ProjectSummary = Omit<Project, "plan"> & {
  planTitle: string;
  sceneCount: number;
};
