import { NextResponse } from "next/server";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import type { ProjectSummary } from "@/lib/plan/schema";
import { listWorkspaceProjects } from "@/lib/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const projects = await listWorkspaceProjects(workspace.id);
    const summaries: ProjectSummary[] = projects.map((project) => ({
      id: project.id,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      input: {
        description: project.planV2.prompt,
        targetSeconds: project.plan.targetSeconds,
        styleId: project.plan.styleId,
        model: project.model,
      },
      planTitle: project.plan.title,
      sceneCount: project.plan.scenes.length,
      model: project.model,
      fellBack: false,
      renders: [],
    }));
    return NextResponse.json({ projects: summaries });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status },
    );
  }
}
