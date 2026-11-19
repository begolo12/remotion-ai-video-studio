import {
  MAX_SECONDS,
  MIN_SECONDS,
  SCENE_TEMPLATES,
  STYLE_IDS,
  VISUAL_KINDS,
  planSchema,
  type Scene,
  type StyleId,
  type VideoPlan,
} from "./schema";

const asString = (value: unknown, max: number): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
};

const asStringList = (value: unknown, max: number, limit: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, max))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
};

const asTemplate = (value: unknown): Scene["template"] => {
  const candidate = typeof value === "string" ? value.toLowerCase().trim() : "";
  return (SCENE_TEMPLATES as readonly string[]).includes(candidate)
    ? (candidate as Scene["template"])
    : "statement";
};

const asVisual = (value: unknown, index: number): Scene["visual"] => {
  const candidate = typeof value === "string" ? value.toLowerCase().trim() : "";
  if ((VISUAL_KINDS as readonly string[]).includes(candidate)) {
    return candidate as Scene["visual"];
  }
  // Pilihan cadangan yang beragam supaya video tidak monoton.
  return (["vehicle", "container", "factory", "ship", "globe", "chart", "person", "lab"] as const)[
    index % 8
  ];
};

const sanitizeScene = (raw: unknown, index: number): Scene | null => {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const template = asTemplate(input.template);

  const scene: Scene = {
    template,
    visual: asVisual(input.visual ?? input.object ?? input.image, index),
    chapter: asString(input.chapter, 60)?.toUpperCase(),
    chapterSub: asString(input.chapterSub ?? input.chapter_sub, 60),
    keyword: asString(input.keyword, 30),
    callouts: asStringList(input.callouts ?? input.labels, 30, 3),
    heading: asString(input.heading ?? input.title, 90),
    subheading: asString(input.subheading ?? input.subtitle, 140),
    bullets: asStringList(input.bullets ?? input.points, 80, 5),
    value: asString(input.value ?? input.stat ?? input.number, 12),
    label: asString(input.label, 60),
    quote: asString(input.quote, 180),
    author: asString(input.author, 60),
    text: asString(input.text ?? input.body, 220),
    narration: asString(input.narration ?? input.voiceover, 300),
    weight: typeof input.weight === "number" && input.weight > 0 ? input.weight : undefined,
  };

  // Buang field yang tidak relevan supaya schema tetap valid.
  if (scene.bullets && scene.bullets.length === 0) delete scene.bullets;
  if (!scene.heading && !scene.text && !scene.quote && !scene.bullets && !scene.value) {
    return null;
  }
  if (template === "bullets" && !scene.bullets) {
    scene.bullets = [scene.heading ?? scene.text ?? `Poin ${index + 1}`];
  }
  if (template === "stat" && !scene.value) {
    scene.value = asString(scene.heading, 12) ?? "100%";
  }
  if (template === "quote" && !scene.quote) {
    scene.quote = scene.text ?? scene.heading;
  }
  if (template === "hook" && !scene.heading) {
    scene.heading = scene.text ?? scene.quote;
  }

  return scene;
};

export class PlanValidationError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

export type NormalizeOptions = {
  styleId: StyleId;
  targetSeconds: number;
  fallbackTitle?: string;
  fallbackHook?: string;
};

/**
 * Merapikan keluaran AI yang sering "hampir benar" (key beda, teks kepanjangan,
 * template tak dikenal) sebelum divalidasi ketat oleh zod.
 */
export const normalizePlan = (raw: unknown, options: NormalizeOptions): VideoPlan => {
  if (!raw || typeof raw !== "object") {
    throw new PlanValidationError("AI tidak mengembalikan objek JSON yang valid");
  }
  const input = raw as Record<string, unknown>;

  const rawScenes = Array.isArray(input.scenes)
    ? input.scenes
    : Array.isArray(input.blocks)
      ? input.blocks
      : [];

  const scenes = rawScenes
    .map((scene, index) => sanitizeScene(scene, index))
    .filter((scene): scene is Scene => Boolean(scene))
    .slice(0, 16);

  const fallbackHook = asString(options.fallbackHook, 120) ?? "Hook video belum tersedia";
  if (scenes.length === 0) {
    scenes.push({
      template: "hook",
      heading: asString(input.hook, 90) ?? fallbackHook,
      narration: asString(input.hook, 300),
    });
  }

  // Bila AI lupa narasi pada sebagian scene, pakai teks layar sebagai cadangan
  // supaya video tidak punya bagian tanpa suara.
  const filledScenes = scenes.map((scene) => {
    if (scene.narration && scene.narration.trim().length >= 12) return scene;
    const fallback = [scene.heading, scene.text, scene.quote, ...(scene.bullets ?? [])]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(". ");
    return fallback ? { ...scene, narration: fallback.slice(0, 300) } : scene;
  });

  const outroRaw = (input.outro ?? input.cta ?? {}) as Record<string, unknown>;
  const outroHeading =
    asString(outroRaw.heading ?? outroRaw.title, 90) ?? "Simpan video ini";
  const outroCta =
    asString(outroRaw.cta ?? outroRaw.text ?? outroRaw.subheading, 120) ??
    "Ikuti untuk tips berikutnya";

  const styleCandidate = typeof input.styleId === "string" ? input.styleId.trim() : "";
  const styleId = (STYLE_IDS as readonly string[]).includes(styleCandidate)
    ? (styleCandidate as StyleId)
    : options.styleId;

  const targetSeconds = Math.min(
    MAX_SECONDS,
    Math.max(MIN_SECONDS, Math.round(options.targetSeconds)),
  );

  const narrationFromScenes = filledScenes
    .map((scene) => scene.narration)
    .filter((line): line is string => Boolean(line));

  const candidate = {
    version: 1 as const,
    title: asString(input.title, 100) ?? options.fallbackTitle ?? "Video Short",
    hook: asString(input.hook, 120) ?? fallbackHook,
    styleId,
    targetSeconds,
    scenes: filledScenes,
    outro: { heading: outroHeading, cta: outroCta },
    caption:
      asString(input.caption ?? input.description, 1200) ??
      asString(options.fallbackHook, 1200) ??
      "Video pendek otomatis dari Remotion Studio.",
    hashtags: asStringList(input.hashtags ?? input.tags, 40, 15),
    narration: narrationFromScenes,
    musicMood: asString(input.musicMood ?? input.music, 60),
  };

  const parsed = planSchema.safeParse(candidate);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new PlanValidationError("Rencana video dari AI tidak lolos validasi", detail);
  }
  return parsed.data;
};
