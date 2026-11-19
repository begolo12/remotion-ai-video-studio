import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import { reviewPlan } from "@/lib/ai/pipeline";
import { installAiRunLogger } from "@/lib/integrations/ai-logger";
import { getStoredProject, saveProjectRevision } from "@/lib/projects/service";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ projectId: z.string().uuid() });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "projectId harus UUID" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const stored = await getStoredProject(parsed.data.projectId, workspace.id);
    if (!stored) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

    installAiRunLogger({ workspaceId: workspace.id, userId: user.id, projectId: stored.id });
    const issues = await reviewPlan(stored.planV2);
    const saved = await saveProjectRevision({
      projectId: stored.id,
      workspaceId: workspace.id,
      createdBy: user.id,
      planV2: { ...stored.planV2, quality: issues, updatedAt: new Date().toISOString() },
      source: "quality_review",
      changeSummary: `Quality review: ${issues.length} catatan`,
    });
    return NextResponse.json({ issues, revision: saved.revisionNumber });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status },
    );
  }
}
