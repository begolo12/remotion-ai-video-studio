import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { AccessError, ensurePersonalWorkspace, requireUser } from "@/lib/auth/access";
import { db } from "@/lib/db/client";
import { renderArtifacts } from "@/lib/db/schema";
import { completeRenderJob, getRenderJob, updateRenderJob } from "@/lib/jobs/queue";
import { getSandboxRenderProgress, saveRenderedVideo } from "@/lib/render/vercel";
import { publicAssetUrl } from "@/lib/storage/blob";
import { toLegacyJob } from "@/app/api/render/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const user = await requireUser();
    await ensurePersonalWorkspace(user.id);

    let job = await getRenderJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job render tidak ditemukan" }, { status: 404 });
    }

    if (job.sandboxId && job.commandId && !["completed", "failed", "cancelled", "expired"].includes(job.status)) {
      try {
        const progress = await getSandboxRenderProgress({
          sandboxId: job.sandboxId,
          commandId: job.commandId,
          outputFile: "/tmp/video.mp4",
        });
        if (progress.error) {
          await updateRenderJob(job.id, { status: "failed", errorCode: "REMOTION_RENDER_FAILED", errorMessage: progress.error });
        } else if (progress.done && !progress.error) {
          try {
            const stored = await saveRenderedVideo(
              { sandboxId: job.sandboxId, commandId: job.commandId, outputFile: "/tmp/video.mp4" },
              job.id,
            );
            await completeRenderJob(job.id, [
              {
                artifactType: "mp4",
                storageKey: stored.storageKey,
                url: publicAssetUrl(stored.storageKey),
                mimeType: "video/mp4",
                fileSize: stored.size,
              },
            ]);
          } catch (saveError) {
            await updateRenderJob(job.id, {
              status: "failed",
              errorCode: "BLOB_UPLOAD_FAILED",
              errorMessage: saveError instanceof Error ? saveError.message : String(saveError),
            });
          }
        } else if (progress.done) {
          await updateRenderJob(job.id, {
            status: "failed",
            errorCode: "REMOTION_RENDER_FAILED",
            errorMessage: progress.error ?? "Render gagal",
          });
        } else {
          await updateRenderJob(job.id, { status: "rendering", stage: "rendering", progress: Math.round(progress.progress * 100) });
        }
      } catch (error) {
        await updateRenderJob(job.id, {
          status: "failed",
          errorCode: "SANDBOX_EXPIRED",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      job = await getRenderJob(jobId);
      if (!job) return NextResponse.json({ error: "Job render tidak ditemukan" }, { status: 404 });
    }

    const artifacts = await db
      .select()
      .from(renderArtifacts)
      .where(eq(renderArtifacts.jobId, job.id));
    const mp4 = artifacts.find((item) => item.artifactType === "mp4");

    return NextResponse.json({
      job: toLegacyJob(job, { url: mp4?.url, message: job.errorMessage ?? undefined }),
    });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status },
    );
  }
}
