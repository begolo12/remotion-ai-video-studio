import { z } from "zod";
import type { StyleId } from "../plan/schema";
import {
  buildBriefPrompt,
  buildMetadataPrompt,
  buildRewritePrompt,
  buildReviewPrompt,
  buildSceneRegeneratePrompt,
  buildStoryboardPrompt,
  SYSTEM_STORYBOARD,
} from "../plan/prompts";
import {
  createEmptyPlanV2,
  defaultStyleBible,
  planV2Schema,
  publishingSchema,
  qualityIssueSchema,
  v2SceneSchema,
  type PlanV2,
  type QualityIssue,
  type V2Scene,
} from "../plan/v2";
import { AiProviderError } from "./errors";
import { inferhubProvider, type ChatInput, type ChatMessage } from "./provider";

export type StoryboardInput = {
  prompt: string;
  targetSeconds: number;
  styleId: StyleId;
  language?: string;
  audience?: string;
  tone?: string;
  targetPlatform?: PlanV2["targetPlatform"];
  model?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
};

export type SceneRegenInput = {
  plan: PlanV2;
  sceneId: string;
  instruction: string;
  model?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
};

export type RewriteInput = {
  text: string;
  instruction: string;
  model?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
};

type RequestContext = {
  model?: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
};

const invalidJson = (message: string, detail?: string): AiProviderError =>
  new AiProviderError(message, { code: "INVALID_JSON", retryable: false, detail });

/** Ambil objek JSON pertama dari jawaban AI, termasuk di dalam code fence. */
export const extractJson = (raw: string): unknown => {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), text].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // coba kandidat berikutnya / pencarian substring
    }
  }

  for (const candidate of candidates) {
    const objectStart = candidate.indexOf("{");
    const objectEnd = candidate.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(candidate.slice(objectStart, objectEnd + 1)) as unknown;
      } catch {
        // lanjut
      }
    }
    const arrayStart = candidate.indexOf("[");
    const arrayEnd = candidate.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(candidate.slice(arrayStart, arrayEnd + 1)) as unknown;
      } catch {
        // lanjut
      }
    }
  }

  throw invalidJson("Jawaban AI tidak mengandung JSON yang bisa dibaca");
};

const zodErrors = (error: z.ZodError): string =>
  error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

type ParseResult<T> = { success: true; data: T } | { success: false; errors: string };

const parseStructured = <T>(raw: string, schema: z.ZodType<T>): ParseResult<T> => {
  try {
    const parsed = schema.safeParse(extractJson(raw));
    if (parsed.success) return { success: true, data: parsed.data };
    return { success: false, errors: zodErrors(parsed.error) };
  } catch (error) {
    return {
      success: false,
      errors: error instanceof Error ? error.message : String(error),
    };
  }
};

const baseChatInput = (ctx: RequestContext): Pick<ChatInput, "model" | "context"> => ({
  model: ctx.model,
  context: {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
  },
});

const systemMessage = (): ChatMessage => ({ role: "system", content: SYSTEM_STORYBOARD });

const repairMessages = (
  base: ChatMessage[],
  previous: string,
  errors: string,
): ChatMessage[] => [
  ...base,
  { role: "assistant", content: previous.slice(0, 4000) },
  {
    role: "user",
    content: `JSON sebelumnya tidak lolos validasi: ${errors
      .slice(0, 1500)
      .replace(/[\r\n]+/g, " ")}. Perbaiki dan balas HANYA JSON valid sesuai skema.`,
  },
];

/**
 * Minta JSON terstruktur. Validasi gagal = satu kali retry dengan pesan perbaikan
 * yang menyertakan error Zod, lalu menyerah dengan AiProviderError.
 */
const askStructured = async <T>(options: {
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  ctx: RequestContext;
  operation: string;
}): Promise<T> => {
  const shared = baseChatInput(options.ctx);
  const first = await inferhubProvider.chat({
    ...shared,
    messages: options.messages,
    temperature: 0.7,
    jsonMode: true,
    operation: options.operation,
  });
  const firstParse = parseStructured(first.content, options.schema);
  if (firstParse.success) return firstParse.data;

  const second = await inferhubProvider.chat({
    ...shared,
    messages: repairMessages(options.messages, first.content, firstParse.errors),
    temperature: 0.2,
    jsonMode: true,
    operation: options.operation,
  });
  const secondParse = parseStructured(second.content, options.schema);
  if (secondParse.success) return secondParse.data;

  throw invalidJson("Respons AI tidak lolos validasi skema setelah satu kali perbaikan", secondParse.errors);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const briefSchema = z.object({
  angle: z.string().trim().min(1).max(300),
  audience: z.string().trim().min(1).max(300),
  promise: z.string().trim().min(1).max(300),
  emotionalArc: z.string().trim().min(1).max(400),
  keyFacts: z.array(z.string().trim().min(1).max(300)).max(12),
  exclusions: z.array(z.string().trim().min(1).max(300)).max(12),
});

const reviewSchema = z.object({ issues: z.array(qualityIssueSchema) });
const rewriteSchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** Rapikan hasil AI agar deterministik tanpa mengubah kreativitasnya. */
const normalizeGeneratedPlan = (plan: PlanV2, input: StoryboardInput): PlanV2 => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const fallback = createEmptyPlanV2({
    prompt: input.prompt,
    targetSeconds: input.targetSeconds,
    styleId: input.styleId,
    language: input.language,
  });
  const totalDuration =
    plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) || input.targetSeconds;
  const scenes: V2Scene[] = plan.scenes.map((scene, index) => ({
    ...scene,
    id: `${id}-scene-${index + 1}`,
    order: index + 1,
    durationSeconds: Number(
      clamp((scene.durationSeconds / totalDuration) * input.targetSeconds, 0.5, 120).toFixed(1),
    ),
  }));

  const candidate: PlanV2 = {
    ...plan,
    schemaVersion: 2,
    id,
    prompt: input.prompt,
    language: input.language ?? "id",
    audience: input.audience ?? plan.audience,
    tone: input.tone ?? plan.tone,
    targetPlatform: input.targetPlatform ?? "youtube-shorts",
    targetSeconds: input.targetSeconds,
    styleId: input.styleId,
    styleBible: { ...defaultStyleBible(input.styleId), ...plan.styleBible },
    scenes,
    publishing: { ...fallback.publishing, ...plan.publishing },
    quality: [],
    createdAt: now,
    updatedAt: now,
  };

  const validated = planV2Schema.safeParse(candidate);
  if (!validated.success) {
    throw invalidJson("Storyboard hasil AI tidak lolos normalisasi", zodErrors(validated.error));
  }
  return validated.data;
};

export async function generateBrief(
  input: StoryboardInput,
): Promise<{
  angle: string;
  audience: string;
  promise: string;
  emotionalArc: string;
  keyFacts: string[];
  exclusions: string[];
}> {
  return askStructured({
    schema: briefSchema,
    messages: [systemMessage(), { role: "user", content: buildBriefPrompt(input) }],
    ctx: input,
    operation: "generateBrief",
  });
}

export async function generateStoryboard(input: StoryboardInput): Promise<PlanV2> {
  const raw = await askStructured({
    schema: planV2Schema,
    messages: [systemMessage(), { role: "user", content: buildStoryboardPrompt(input) }],
    ctx: input,
    operation: "generateStoryboard",
  });
  return normalizeGeneratedPlan(raw, input);
}

export async function regenerateScene(input: SceneRegenInput): Promise<V2Scene> {
  const scene = input.plan.scenes.find((item) => item.id === input.sceneId);
  if (!scene) {
    throw new AiProviderError(`Scene ${input.sceneId} tidak ditemukan di rencana`, {
      code: "INVALID_JSON",
      retryable: false,
    });
  }
  const raw = await askStructured({
    schema: v2SceneSchema,
    messages: [
      systemMessage(),
      { role: "user", content: buildSceneRegeneratePrompt({ plan: input.plan, scene, instruction: input.instruction }) },
    ],
    ctx: input,
    operation: "regenerateScene",
  });
  const candidate = { ...raw, id: scene.id, order: scene.order };
  const validated = v2SceneSchema.safeParse(candidate);
  if (!validated.success) {
    throw invalidJson("Scene hasil regenerasi tidak lolos normalisasi", zodErrors(validated.error));
  }
  return validated.data;
}

export async function reviewPlan(
  plan: PlanV2,
  input?: Partial<StoryboardInput>,
): Promise<QualityIssue[]> {
  const result = await askStructured({
    schema: reviewSchema,
    messages: [systemMessage(), { role: "user", content: buildReviewPrompt(plan) }],
    ctx: input ?? {},
    operation: "reviewPlan",
  });
  return result.issues;
}

export async function generatePublishingMetadata(
  plan: PlanV2,
  input?: Partial<StoryboardInput>,
): Promise<PlanV2["publishing"]> {
  return askStructured({
    schema: publishingSchema,
    messages: [systemMessage(), { role: "user", content: buildMetadataPrompt(plan) }],
    ctx: input ?? {},
    operation: "generatePublishingMetadata",
  });
}

export async function rewriteText(input: RewriteInput): Promise<string> {
  const result = await askStructured({
    schema: rewriteSchema,
    messages: [systemMessage(), { role: "user", content: buildRewritePrompt(input) }],
    ctx: input,
    operation: "rewriteText",
  });
  return result.text;
}
