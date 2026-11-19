import { NextResponse } from "next/server";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import { enqueueRenderJob, failRenderJob, updateRenderJob } from "@/lib/jobs/queue";
import type { RenderJobRecord } from "@/lib/jobs/types";
import { checkExportReadiness } from "@/lib/render/checklist";
import { startSandboxRender } from "@/lib/render/vercel";
import { getStoredProject } from "@/lib/projects/service";
import { renderRequestSchema } from "@/lib/plan/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

type LegacyStatus = "queued" | "rendering" | "done" | "error";

export const toLegacyJob = (
  job: RenderJobRecord,
  extra: { url?: string; message?: string } = {},
) => {
  const status: LegacyStatus =
    job.status === "completed"
      ? "done"
      : job.status === "failed" || job.status === "cancelled" || job.status === "expired"
        ? "error"
        : job.status === "queued"
          ? "queued"
          : "rendering";
  return {
    id: job.id,
    projectId: job.projectId,
    status,
    progress: job.progress,
    message: job.errorMessage ?? extra.message,
    url: extra.url,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.completedAt?.toISOString(),
    logs: [],
  };
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const workspace = await ensurePersonalWorkspace(user.id);
    const stored = await getStoredProject(parsed.data.projectId, workspace.id);
    if (!stored) {
      return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
    }

    const checks = checkExportReadiness(stored.planV2, { narration: { enabled: true, scenes: stored.plan.scenes.length } });
    const blockers = checks.filter((check) => !check.passed && check.severity === "error");
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "Project belum siap dirender",
          issues: blockers.map((check) => ({ path: check.code, message: `${check.label}: ${check.detail ?? ""}` })),
        },
        { status: 422 },
      );
    }

    const job = await enqueueRenderJob({
      projectId: stored.id,
      revisionId: stored.revisionId,
      workspaceId: workspace.id,
      requestedBy: user.id,
    });

    try {
      const serveUrl = process.env.RENDER_SERVE_URL ?? new URL(request.url).origin;
      const handle = await startSandboxRender({
        jobId: job.id,
        projectId: stored.id,
        plan: stored.plan,
        serveUrl,
        blobPathPrefix: `projects/${stored.id}`,
      });
      await updateRenderJob(job.id, {
        status: "rendering",
        stage: "rendering",
        sandboxId: handle.sandboxId,
        commandId: handle.commandId,
        startedAt: new Date(),
      });
      return NextResponse.json({ job: toLegacyJob({ ...job, status: "rendering" as never }) });
    } catch (renderError) {
      await failRenderJob(job.id, {
        code: "REMOTION_RENDER_FAILED",
        message: renderError instanceof Error ? renderError.message : String(renderError),
      });
      const failed = await import("@/lib/jobs/queue").then((m) => m.getRenderJob(job.id));
      return NextResponse.json(
        { job: toLegacyJob(failed ?? job), error: "Render gagal dimulai" },
        { status: 202 },
      );
    }
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status },
    );
  }
}
