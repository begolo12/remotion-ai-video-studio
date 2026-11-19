import { z } from "zod";
import {
  MAX_SECONDS,
  MIN_SECONDS,
  SCENE_TEMPLATES,
  STYLE_IDS,
  VISUAL_KINDS,
  type Scene,
  type StyleId,
  type VideoPlan,
} from "./schema";
import { STYLE_TOKENS } from "./styles";

export type QualityIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  sceneId?: string;
};

export type StyleBible = {
  palette: string[];
  typography: string;
  captionStyle: string;
  backgroundStyle: string;
  cameraLanguage: string;
  transitionLanguage: string;
  visualDensity: "low" | "medium" | "high";
  lighting: string;
  texture: string;
  prohibitedPatterns: string[];
};

export type V2Scene = {
  id: string;
  order: number;
  type: (typeof SCENE_TEMPLATES)[number];
  purpose: string;
  visual: (typeof VISUAL_KINDS)[number];
  durationSeconds: number;
  heading: string;
  subheading?: string;
  bullets?: string[];
  value?: string;
  label?: string;
  quote?: string;
  author?: string;
  text?: string;
  chapter?: string;
  chapterSub?: string;
  keyword?: string;
  callouts?: string[];
  narration: string;
  caption: string;
  visualDirection: string;
  camera: "push-in" | "pull-out" | "pan-left" | "pan-right" | "static";
  transitionIn: "fade" | "cut" | "slide";
  assetBrief: {
    subject: string;
    composition: string;
    lighting: string;
    mood: string;
    aspectRatio: "9:16";
    negativePrompt?: string;
  };
  assetRefs: string[];
  emphasis?: string[];
  weight: number;
};

export type PlanV2 = {
  schemaVersion: 2;
  id: string;
  title: string;
  prompt: string;
  language: string;
  audience: string;
  tone: string;
  targetPlatform: "youtube-shorts" | "tiktok" | "instagram-reels";
  targetSeconds: number;
  styleId: StyleId;
  styleBible: StyleBible;
  hook: string;
  keyMessage: string;
  scenes: V2Scene[];
  outro: { heading: string; cta: string };
  publishing: {
    title: string;
    description: string;
    hashtags: string[];
    pinnedComment: string;
    thumbnailText: string;
  };
  quality: QualityIssue[];
  createdAt: string;
  updatedAt: string;
};

const TRIMMED = (max: number) => z.string().trim().min(1).max(max);

export const qualityIssueSchema: z.ZodType<QualityIssue> = z.object({
  code: z.string().trim().min(1).max(80),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string().trim().min(1).max(400),
  sceneId: z.string().trim().min(1).max(120).optional(),
});

export const styleBibleSchema: z.ZodType<StyleBible> = z.object({
  palette: z.array(TRIMMED(40)).min(2).max(8),
  typography: TRIMMED(160),
  captionStyle: TRIMMED(200),
  backgroundStyle: TRIMMED(300),
  cameraLanguage: TRIMMED(200),
  transitionLanguage: TRIMMED(200),
  visualDensity: z.enum(["low", "medium", "high"]),
  lighting: TRIMMED(160),
  texture: TRIMMED(160),
  prohibitedPatterns: z.array(TRIMMED(200)).max(12).default([]),
});

export const v2SceneSchema: z.ZodType<V2Scene> = z.object({
  id: TRIMMED(120),
  order: z.number().int().min(1),
  type: z.enum(SCENE_TEMPLATES),
  purpose: TRIMMED(160),
  visual: z.enum(VISUAL_KINDS),
  durationSeconds: z.number().min(0.5).max(120),
  heading: TRIMMED(90),
  subheading: z.string().trim().max(140).optional(),
  bullets: z.array(TRIMMED(80)).min(1).max(5).optional(),
  value: z.string().trim().max(12).optional(),
  label: z.string().trim().max(60).optional(),
  quote: z.string().trim().max(180).optional(),
  author: z.string().trim().max(60).optional(),
  text: z.string().trim().max(220).optional(),
  chapter: z.string().trim().max(60).optional(),
  chapterSub: z.string().trim().max(60).optional(),
  keyword: z.string().trim().max(30).optional(),
  callouts: z.array(TRIMMED(30)).min(1).max(3).optional(),
  narration: z.string().trim().max(300),
  caption: z.string().trim().min(1).max(240),
  visualDirection: TRIMMED(300),
  camera: z.enum(["push-in", "pull-out", "pan-left", "pan-right", "static"]),
  transitionIn: z.enum(["fade", "cut", "slide"]),
  assetBrief: z.object({
    subject: TRIMMED(200),
    composition: TRIMMED(240),
    lighting: TRIMMED(160),
    mood: TRIMMED(160),
    aspectRatio: z.literal("9:16"),
    negativePrompt: z.string().trim().max(300).optional(),
  }),
  assetRefs: z.array(z.string().trim().min(1).max(200)).default([]),
  emphasis: z.array(TRIMMED(60)).max(5).optional(),
  weight: z.number().min(0.4).max(3),
});

export const publishingSchema = z.object({
  title: TRIMMED(100),
  description: TRIMMED(1200),
  hashtags: z.array(TRIMMED(40)).max(15).default([]),
  pinnedComment: z.string().trim().max(300),
  thumbnailText: TRIMMED(60),
});

/**
 * Model sering mengirim catatan kualitas dengan nama field lain (`type`,
 * `text`, `level`). Normalisasi di sini mencegah seluruh storyboard ditolak
 * hanya karena satu catatan kualitas tidak sesuai format.
 */
const normalizeQuality = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const code =
        typeof raw.code === "string"
          ? raw.code
          : typeof raw.issue === "string"
            ? raw.issue
            : typeof raw.type === "string"
              ? raw.type
              : undefined;
      const message =
        typeof raw.message === "string"
          ? raw.message
          : typeof raw.text === "string"
            ? raw.text
            : typeof raw.detail === "string"
              ? raw.detail
              : undefined;
      if (!code || !message) return null;
      const rawSeverity = raw.severity ?? raw.level ?? raw.type;
      const severity =
        rawSeverity === "error" || rawSeverity === "warning" || rawSeverity === "info"
          ? rawSeverity
          : "info";
      return {
        code: code.slice(0, 80),
        severity,
        message: message.slice(0, 400),
        ...(typeof raw.sceneId === "string" ? { sceneId: raw.sceneId } : {}),
      };
    })
    .filter((item) => item !== null) as QualityIssue[];
};

export const planV2Schema: z.ZodType<PlanV2> = z.object({
  schemaVersion: z.literal(2),
  id: TRIMMED(120),
  title: TRIMMED(100),
  prompt: z.string().trim().max(2000),
  language: TRIMMED(40),
  audience: TRIMMED(120),
  tone: TRIMMED(120),
  targetPlatform: z.enum(["youtube-shorts", "tiktok", "instagram-reels"]),
  targetSeconds: z.number().min(MIN_SECONDS).max(MAX_SECONDS),
  styleId: z.enum(STYLE_IDS),
  styleBible: styleBibleSchema,
  hook: TRIMMED(120),
  keyMessage: TRIMMED(200),
  scenes: z.array(v2SceneSchema).min(1).max(16),
  outro: z.object({ heading: TRIMMED(90), cta: TRIMMED(120) }),
  publishing: publishingSchema,
  quality: z.preprocess(normalizeQuality, z.array(qualityIssueSchema).default([])),
  createdAt: TRIMMED(60),
  updatedAt: TRIMMED(60),
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const compact = (value: string | undefined, max: number): string | undefined => {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
};

/** Style bible yang dipakai bila AI tidak mengirim detail visual. */
export const defaultStyleBible = (styleId: StyleId): StyleBible => {
  const tokens = STYLE_TOKENS[styleId];
  return {
    palette: [tokens.accent, tokens.accent2, tokens.text, tokens.background.slice(0, 40)],
    typography: `${tokens.fontDisplay} untuk judul; ${tokens.fontBody} untuk caption`,
    captionStyle: "karaoke per kata, maksimal 4 kata per grup, di dalam safe zone 9:16",
    backgroundStyle: tokens.background,
    cameraLanguage: "push-in perlahan di hook, static saat penjelasan, pull-out di penutup",
    transitionLanguage: "fade antar bab, cut cepat antar poin, slide untuk perbandingan",
    visualDensity: styleId === "minimal" ? "low" : styleId === "neon" ? "high" : "medium",
    lighting: styleId === "cinematic" ? "low-key dengan rim light amber" : `${tokens.accent} accent light`,
    texture: tokens.grain ? "film grain halus" : "vektor bersih tanpa noise",
    prohibitedPatterns: [
      "slide teks generik tanpa ilustrasi",
      "statistik tanpa sumber",
      "teks di luar safe zone 9:16",
      "visual bertentangan dengan narasi",
    ],
  };
};

const defaultPublishing = (plan: Pick<PlanV2, "title" | "hook" | "prompt">): PlanV2["publishing"] => ({
  title: plan.title.slice(0, 100),
  description: plan.prompt.slice(0, 1200) || `Video pendek: ${plan.title}`.slice(0, 1200),
  hashtags: ["#shorts"],
  pinnedComment: "Mau dibahas topik apa berikutnya? Tulis di kolom komentar.",
  thumbnailText: plan.hook.slice(0, 60),
});

/** Turunkan bobot durasi ke format `weight` yang dipakai engine Remotion v1. */
const weightFromDuration = (seconds: number): number =>
  Number(clamp(seconds / 5, 0.4, 3).toFixed(2));

/**
 * Jembatan ke engine lama: PlanV2 adalah superset, jadi cukup dibongkar
 * menjadi Scene v1 tanpa menyentuh komponen Remotion yang sudah ada.
 */
export const toLegacyPlan = (plan: PlanV2): VideoPlan => {
  const scenes: Scene[] = plan.scenes.map((scene) => {
    const legacy: Scene = {
      template: scene.type,
      visual: scene.visual,
      heading: scene.heading.slice(0, 90),
      narration: scene.narration.slice(0, 300),
      weight: weightFromDuration(scene.durationSeconds),
    };
    const optional = {
      subheading: compact(scene.subheading, 140),
      bullets: scene.bullets?.length ? scene.bullets.map((b) => b.slice(0, 80)).slice(0, 5) : undefined,
      value: compact(scene.value, 12),
      label: compact(scene.label, 60),
      quote: compact(scene.quote, 180),
      author: compact(scene.author, 60),
      text: compact(scene.text, 220),
      chapter: compact(scene.chapter, 60)?.toUpperCase(),
      chapterSub: compact(scene.chapterSub, 60),
      keyword: compact(scene.keyword, 30),
      callouts: scene.callouts?.length
        ? scene.callouts.map((c) => c.slice(0, 30)).slice(0, 3)
        : undefined,
    };
    for (const [key, value] of Object.entries(optional)) {
      if (value !== undefined) {
        (legacy as Record<string, unknown>)[key] = value;
      }
    }
    return legacy;
  });

  const narration = scenes
    .map((scene) => scene.narration)
    .filter((line): line is string => Boolean(line));
  const caption =
    compact(plan.publishing.description, 1200) ??
    compact(plan.publishing.title, 1200) ??
    plan.title;

  return {
    version: 1,
    title: plan.title,
    hook: plan.hook,
    styleId: plan.styleId,
    targetSeconds: clamp(Math.round(plan.targetSeconds), MIN_SECONDS, MAX_SECONDS),
    scenes,
    outro: { heading: plan.outro.heading, cta: plan.outro.cta },
    caption,
    hashtags: plan.publishing.hashtags.slice(0, 15),
    narration,
    musicMood: compact(plan.tone, 60),
  };
};

/** Angkat rencana v1 menjadi v2 tanpa kehilangan judul, hook, atau gaya visual. */
export const fromLegacyPlan = (
  plan: VideoPlan,
  meta: { prompt: string; id?: string; audience?: string; tone?: string },
): PlanV2 => {
  const id = meta.id ?? crypto.randomUUID();
  const styleBible = defaultStyleBible(plan.styleId);
  const now = new Date().toISOString();
  const totalWeight = plan.scenes.reduce((sum, scene) => sum + (scene.weight ?? 1), 0) || plan.scenes.length || 1;

  const scenes: V2Scene[] = plan.scenes.map((scene, index) => {
    const weight = scene.weight ?? 1;
    const durationSeconds = Number(
      clamp((plan.targetSeconds * weight) / totalWeight, 0.5, 120).toFixed(1),
    );
    const subject = scene.visual ?? "finale";
    const heading = scene.heading ?? scene.text ?? scene.quote ?? `Scene ${index + 1}`;
    return {
      id: `${id}-scene-${index + 1}`,
      order: index + 1,
      type: scene.template,
      purpose: compact(scene.chapter, 160) ?? heading,
      visual: subject,
      durationSeconds,
      heading,
      subheading: scene.subheading,
      bullets: scene.bullets,
      value: scene.value,
      label: scene.label,
      quote: scene.quote,
      author: scene.author,
      text: scene.text,
      chapter: scene.chapter,
      chapterSub: scene.chapterSub,
      keyword: scene.keyword,
      callouts: scene.callouts,
      narration: scene.narration ?? "",
      caption: (compact(heading, 240) ?? `Scene ${index + 1}`).slice(0, 240),
      visualDirection: `Ilustrasi ${subject}, komposisi ${styleBible.visualDensity}, ${styleBible.lighting}`.slice(
        0,
        300,
      ),
      camera: (["push-in", "static", "pan-right", "pull-out"] as const)[index % 4],
      transitionIn: index === 0 ? "fade" : "cut",
      assetBrief: {
        subject,
        composition: "subjek di tengah, berada di dalam safe zone 9:16, ruang untuk caption bawah",
        lighting: styleBible.lighting,
        mood: plan.styleId,
        aspectRatio: "9:16",
        negativePrompt: styleBible.prohibitedPatterns.join("; "),
      },
      assetRefs: [],
      emphasis: scene.callouts ? [...scene.callouts] : undefined,
      weight,
    };
  });

  const publishing = defaultPublishing({ title: plan.title, hook: plan.hook, prompt: meta.prompt });
  publishing.description = plan.caption.slice(0, 1200);
  publishing.hashtags = plan.hashtags.slice(0, 15);

  return {
    schemaVersion: 2,
    id,
    title: plan.title,
    prompt: meta.prompt,
    language: "id",
    audience: meta.audience ?? "penonton YouTube Shorts umum",
    tone: meta.tone ?? "informatif dan ringkas",
    targetPlatform: "youtube-shorts",
    targetSeconds: plan.targetSeconds,
    styleId: plan.styleId,
    styleBible,
    hook: plan.hook,
    keyMessage: plan.hook.slice(0, 200),
    scenes,
    outro: { heading: plan.outro.heading, cta: plan.outro.cta },
    publishing,
    quality: [],
    createdAt: now,
    updatedAt: now,
  };
};

/** Kerangka kosong yang siap diisi AI atau UI. */
export const createEmptyPlanV2 = (input: {
  prompt: string;
  targetSeconds: number;
  styleId: StyleId;
  language?: string;
}): PlanV2 => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const styleBible = defaultStyleBible(input.styleId);
  const prompt = input.prompt.trim() || "Video short tanpa judul";
  const hook = prompt.slice(0, 120);
  const durationSeconds = clamp(input.targetSeconds, 0.5, 120);

  return {
    schemaVersion: 2,
    id,
    title: hook,
    prompt,
    language: input.language ?? "id",
    audience: "penonton YouTube Shorts umum",
    tone: "informatif dan ringkas",
    targetPlatform: "youtube-shorts",
    targetSeconds: clamp(Math.round(input.targetSeconds), MIN_SECONDS, MAX_SECONDS),
    styleId: input.styleId,
    styleBible,
    hook,
    keyMessage: prompt.slice(0, 200),
    scenes: [
      {
        id: `${id}-scene-1`,
        order: 1,
        type: "hook",
        purpose: "Pembuka yang mengajukan pertanyaan",
        visual: "finale",
        durationSeconds,
        heading: hook,
        narration: "",
        caption: hook.slice(0, 240),
        visualDirection: "Ilustrasi pembuka di dalam safe zone 9:16",
        camera: "push-in",
        transitionIn: "fade",
        assetBrief: {
          subject: "finale",
          composition: "subjek utama di tengah dengan ruang untuk caption",
          lighting: styleBible.lighting,
          mood: input.styleId,
          aspectRatio: "9:16",
        },
        assetRefs: [],
        weight: weightFromDuration(durationSeconds),
      },
    ],
    outro: { heading: "Simpan video ini", cta: "Ikuti untuk tips berikutnya" },
    publishing: defaultPublishing({ title: hook, hook, prompt }),
    quality: [],
    createdAt: now,
    updatedAt: now,
  };
};
