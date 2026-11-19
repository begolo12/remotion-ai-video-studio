import { NextResponse } from "next/server";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import { planV2Schema } from "@/lib/plan/v2";
import { getStoredProject, saveProjectRevision } from "@/lib/projects/service";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const stored = await getStoredProject(id, workspace.id);
    if (!stored) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
    }
    const payload = body as { planV2?: unknown; changeSummary?: string };
    const parsed = planV2Schema.safeParse(payload.planV2);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Storyboard tidak valid",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const saved = await saveProjectRevision({
      projectId: id,
      workspaceId: workspace.id,
      createdBy: user.id,
      planV2: parsed.data,
      source: "manual_edit",
      changeSummary: payload.changeSummary ?? "Edit storyboard manual",
    });
    return NextResponse.json({ planV2: saved.planV2, project: saved, revision: saved.revisionNumber });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status },
    );
  }
}
