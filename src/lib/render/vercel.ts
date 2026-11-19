import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addBundleToSandbox,
  createSandbox,
  getRenderProgress,
  renderMediaOnVercel,
} from "@remotion/vercel";
import type { VideoPlan } from "@/lib/plan/schema";

export type RenderHandle = { sandboxId: string; commandId: string; outputFile: string };
export type RenderProgressInfo = { progress: number; done: boolean; error?: string };

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN belum diset, sehingga MP4 tidak bisa diunggah ke Vercel Blob.",
    );
  }
  return token;
}

function safePrefix(prefix: string | undefined, jobId: string): string {
  if (!prefix) return `renders/${jobId}.mp4`;
  const cleaned = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return cleaned ? `${cleaned}/${jobId}.mp4` : `renders/${jobId}.mp4`;
}

function blobAccess(): "public" | "private" {
  const access = process.env.RENDER_BLOB_ACCESS ?? "public";
  if (access !== "public" && access !== "private") {
    throw new Error("RENDER_BLOB_ACCESS harus 'public' atau 'private'");
  }
  return access;
}

async function bundleDir(): Promise<string> {
  const dir = process.env.REMOTION_BUNDLE_DIR
    ? path.resolve(process.env.REMOTION_BUNDLE_DIR)
    : path.join(process.cwd(), ".remotion", "bundle");
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) throw new Error("bukan direktori");
  } catch {
    throw new Error(
      `Bundle Remotion tidak ditemukan di ${dir}. Jalankan 'npx remotion bundle' lebih dulu lalu set REMOTION_BUNDLE_DIR jika lokasinya berbeda.`,
    );
  }
  return dir;
}

/**
 * Memulai render detached di Vercel Sandbox. `serveUrl` tetap diwajibkan oleh
 * kontrak aplikasi dan diteruskan sebagai input props; @remotion/vercel v4
 * membangun videonya dari bundle lokal di sandbox, bukan dari serveUrl jarak jauh.
 */
export async function startSandboxRender(input: {
  jobId: string;
  projectId: string;
  plan: VideoPlan;
  serveUrl: string;
  blobPathPrefix?: string;
}): Promise<RenderHandle> {
  if (!input.jobId?.trim() || !input.projectId?.trim()) {
    throw new Error("jobId dan projectId wajib diisi");
  }
  if (!input.serveUrl?.trim()) {
    throw new Error("serveUrl wajib diisi (URL deployment yang berisi bundle Remotion)");
  }
  try {
    const parsed = new URL(input.serveUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol tidak didukung");
    }
  } catch {
    throw new Error("serveUrl harus berupa URL http(s) yang valid");
  }
  if (!input.plan) {
    throw new Error("plan wajib diisi");
  }

  const token = blobToken();
  const dir = await bundleDir();
  const compositionId = process.env.REMOTION_COMPOSITION_ID || "ShortVideo";
  const blobPath = safePrefix(input.blobPathPrefix, input.jobId);
  const timeout = process.env.RENDER_SANDBOX_TIMEOUT_MS
    ? Number(process.env.RENDER_SANDBOX_TIMEOUT_MS)
    : undefined;
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) {
    throw new Error("RENDER_SANDBOX_TIMEOUT_MS harus angka positif");
  }

  try {
    const sandbox = await createSandbox();
    await addBundleToSandbox({ sandbox, bundleDir: dir });

    const result = await renderMediaOnVercel({
      sandbox,
      compositionId,
      inputProps: {
        plan: input.plan,
        serveUrl: input.serveUrl,
        jobId: input.jobId,
        projectId: input.projectId,
      },
      codec: "h264",
      crf: 18,
      detached: true,
      vercelBlob: { blobToken: token, access: blobAccess(), blobPath },
      ...(timeout !== undefined ? { detachedSandboxTimeoutInMilliseconds: timeout } : {}),
    });

    return { sandboxId: result.sandboxId, commandId: result.cmdId, outputFile: result.outputFile };
  } catch (error) {
    const region = process.env.VERCEL_REGION || "default";
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Gagal memulai render Remotion di sandbox (region ${region}): ${detail}`);
  }
}

export async function getSandboxRenderProgress(
  handle: RenderHandle,
): Promise<RenderProgressInfo> {
  if (!handle?.sandboxId || !handle?.commandId) {
    throw new Error("Handle render tidak lengkap (sandboxId/commandId kosong)");
  }

  const progress = await getRenderProgress({
    sandboxId: handle.sandboxId,
    cmdId: handle.commandId,
  });
  const overall = "overallProgress" in progress ? progress.overallProgress : 0;
  const percent = Math.max(0, Math.min(100, Math.round(overall * 100)));

  if (progress.stage === "done") {
    return { progress: 100, done: true };
  }
  if (progress.stage === "error") {
    return { progress: percent, done: true, error: progress.message };
  }
  if (progress.stage === "expired") {
    return { progress: 0, done: true, error: "Sandbox render kedaluwarsa" };
  }
  return { progress: percent, done: false };
}
