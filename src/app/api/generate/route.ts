import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import { AiProviderError } from "@/lib/ai/errors";
import { generateStoryboard } from "@/lib/ai/pipeline";
import { attachCloudNarration, TTS_VOICES, type TtsVoice } from "@/lib/audio/tts-cloud";
import { installAiRunLogger } from "@/lib/integrations/ai-logger";
import { generateRequestSchema, type Project } from "@/lib/plan/schema";
import { toLegacyPlan } from "@/lib/plan/v2";
import { createProjectWithPlan } from "@/lib/projects/service";

export const runtime = "nodejs";
export const maxDuration = 300;

const errorStatus = (error: unknown): number => {
  if (error instanceof AccessError) return error.status;
  if (error instanceof AiProviderError) {
    if (error.code === "AUTH") return 502;
    if (error.code === "RATE_LIMIT") return 429;
    if (error.code === "TIMEOUT") return 504;
    return 502;
  }
  return 502;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Input tidak valid",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const plannedProjectId = randomUUID();

    installAiRunLogger({
      workspaceId: workspace.id,
      userId: user.id,
      projectId: plannedProjectId,
    });

    const model = parsed.data.model ?? process.env.INFERHUB_MODEL ?? "cx/gpt-6.2-sol";

    const planV2 = await generateStoryboard({
      prompt: parsed.data.description,
      targetSeconds: parsed.data.targetSeconds,
      styleId: parsed.data.styleId,
      language: "id",
      audience: "penonton umum",
      targetPlatform: "youtube-shorts",
      model,
      userId: user.id,
      workspaceId: workspace.id,
      projectId: plannedProjectId,
    });

    let narratedPlan = undefined;
    let narration: Project["narration"] = undefined;

    if (parsed.data.withNarration !== false) {
      const voiceKey = parsed.data.voice;
      const voice = voiceKey && voiceKey in TTS_VOICES ? TTS_VOICES[voiceKey as TtsVoice] : undefined;
      const result = await attachCloudNarration(toLegacyPlan(planV2), plannedProjectId, { voice });
      narratedPlan = result.plan;
      narration = {
        enabled: result.result.enabled,
        voice: result.result.voice,
        scenes: result.result.scenes,
        totalSeconds: result.result.totalSeconds,
        error: result.result.error,
      };
    }

    const stored = await createProjectWithPlan({
      workspaceId: workspace.id,
      createdBy: user.id,
      title: planV2.title,
      prompt: parsed.data.description,
      targetSeconds: parsed.data.targetSeconds,
      styleId: parsed.data.styleId,
      model,
      planV2,
      audioPlan: narratedPlan,
    });

    const project: Project = {
      id: stored.id,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      input: {
        description: parsed.data.description,
        targetSeconds: parsed.data.targetSeconds,
        styleId: parsed.data.styleId,
        model,
      },
      plan: stored.plan,
      model,
      fellBack: false,
      narration,
      renders: [],
    };

    return NextResponse.json({
      project,
      plan: stored.plan,
      planV2: stored.planV2,
      model,
      fellBack: false,
      narration,
      log: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detail = error instanceof AiProviderError ? error.detail : undefined;
    return NextResponse.json(
      { error: message, detail },
      { status: errorStatus(error) },
    );
  }
}
