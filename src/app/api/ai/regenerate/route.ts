import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import { AiProviderError } from "@/lib/ai/errors";
import { regenerateScene } from "@/lib/ai/pipeline";
import { installAiRunLogger } from "@/lib/integrations/ai-logger";
import { getStoredProject, saveProjectRevision } from "@/lib/projects/service";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().min(1).max(120),
  instruction: z.string().trim().min(3).max(1000),
  model: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const stored = await getStoredProject(parsed.data.projectId, workspace.id);
    if (!stored) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

    installAiRunLogger({
      workspaceId: workspace.id,
      userId: user.id,
      projectId: stored.id,
      sceneId: parsed.data.sceneId,
    });

    const scene = await regenerateScene({
      plan: stored.planV2,
      sceneId: parsed.data.sceneId,
      instruction: parsed.data.instruction,
      model: parsed.data.model,
      userId: user.id,
      workspaceId: workspace.id,
      projectId: stored.id,
    });

    const updated = {
      ...stored.planV2,
      scenes: stored.planV2.scenes.map((item) => (item.id === parsed.data.sceneId ? scene : item)),
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveProjectRevision({
      projectId: stored.id,
      workspaceId: workspace.id,
      createdBy: user.id,
      planV2: updated,
      source: "scene_regenerated",
      changeSummary: `Regenerasi scene: ${parsed.data.instruction.slice(0, 120)}`,
    });

    return NextResponse.json({ scene, planV2: saved.planV2, revision: saved.revisionNumber });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status =
      error instanceof AiProviderError && error.code === "RATE_LIMIT"
        ? 429
        : error instanceof AiProviderError && error.code === "TIMEOUT"
          ? 504
          : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status },
    );
  }
}
