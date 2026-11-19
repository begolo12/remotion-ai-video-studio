import { NextResponse } from "next/server";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import type { Project } from "@/lib/plan/schema";
import { deleteStoredProject, getStoredProject } from "@/lib/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const reject = (error: unknown) => {
  const status = error instanceof AccessError ? error.status : 500;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : String(error) },
    { status },
  );
};

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const stored = await getStoredProject(id, workspace.id);
    if (!stored) {
      return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
    }
    const project: Project = {
      id: stored.id,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      input: {
        description: stored.planV2.prompt,
        targetSeconds: stored.plan.targetSeconds,
        styleId: stored.plan.styleId,
        model: stored.model,
      },
      plan: stored.plan,
      model: stored.model,
      fellBack: false,
      narration: undefined,
      renders: [],
    };
    return NextResponse.json({ project, planV2: stored.planV2, revision: stored.revisionNumber });
  } catch (error) {
    return reject(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const stored = await getStoredProject(id, workspace.id);
    if (!stored) {
      return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
    }
    const removed = await deleteStoredProject(id);
    return NextResponse.json({ ok: removed });
  } catch (error) {
    return reject(error);
  }
}
