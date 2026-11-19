import { promises as fs } from "node:fs";
import path from "node:path";
import { Sandbox } from "@vercel/sandbox";
import { addBundleToSandbox, createSandbox, renderMediaOnVercel } from "@remotion/vercel";
import type { VideoPlan } from "@/lib/plan/schema";
import { normalizeKey, putObject, storageRoot, type StoredObject } from "@/lib/storage/blob";

export type RenderHandle = { sandboxId: string; commandId: string; outputFile: string };
export type RenderProgressInfo = { progress: number; done: boolean; error?: string };

function localRenderKey(jobId: string): string {
  return `renders/${jobId}.mp4`;
}

/**
 * Sandbox render tidak punya akses ke file lokal aplikasi. Narasi disisipkan
 * sebagai data URL agar `<Audio>` tetap bisa diputar tanpa Vercel Blob.
 */
async function withEmbeddedAudio(plan: VideoPlan): Promise<VideoPlan> {
  const scenes = await Promise.all(
    plan.scenes.map(async (scene) => {
      if (!scene.audio?.src?.startsWith("/audio/")) return scene;
      const file = path.join(storageRoot(), ...normalizeKey(scene.audio.src.slice(1)).split("/"));
      try {
        const buffer = await fs.readFile(file);
        return {
          ...scene,
          audio: {
            ...scene.audio,
            src: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
          },
        };
      } catch {
        return scene;
      }
    }),
  );
  return { ...plan, scenes };
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

  const dir = await bundleDir();
  const plan = await withEmbeddedAudio(input.plan);
  const compositionId = process.env.REMOTION_COMPOSITION_ID || "ShortVideo";
  void input.blobPathPrefix;
  const timeout = process.env.RENDER_SANDBOX_TIMEOUT_MS
    ? Number(process.env.RENDER_SANDBOX_TIMEOUT_MS)
    : undefined;
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) {
    throw new Error("RENDER_SANDBOX_TIMEOUT_MS harus angka positif");
  }

  try {
    const sandbox = await createSandbox();
    // @remotion/vercel tidak membuat direktori akar bundle sebelum menyalin;
    // tanpa ini mkDir("remotion-bundle/public") gagal karena induknya belum ada.
    await sandbox.mkDir("remotion-bundle");
    await addBundleToSandbox({ sandbox, bundleDir: dir });

    // @ts-expect-error Tipe @remotion/vercel mengharuskan vercelBlob untuk mode
    // detached, tetapi runtime menerima null dan MP4 diambil manual dari sandbox.
    const result = await renderMediaOnVercel({
      sandbox,
      compositionId,
      inputProps: {
        plan,
        serveUrl: input.serveUrl,
        jobId: input.jobId,
        projectId: input.projectId,
      },
      codec: "h264",
      crf: 18,
      detached: true,
      ...(timeout !== undefined ? { detachedSandboxTimeoutInMilliseconds: timeout } : {}),
    });

    const rawSandbox = sandbox as unknown as {
      sessionId?: string;
      session?: { sessionId?: string };
      sandbox?: { name?: string; id?: string };
    };
    // `getRenderProgress` dari @remotion/vercel memanggil Sandbox.get({sandboxId}),
    // tetapi versi @vercel/sandbox yang terpasang mengharapkan `name`. Simpan
    // nama sandbox agar pembacaan progres bisa dilakukan sendiri.
    const sandboxId =
      rawSandbox.sandbox?.name ??
      result.sandboxId ??
      rawSandbox.session?.sessionId ??
      rawSandbox.sessionId ??
      "";
    if (!sandboxId) {
      throw new Error("Render sandbox tidak mengembalikan sandboxId");
    }
    return { sandboxId, commandId: result.cmdId, outputFile: result.outputFile };
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

  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.get({ name: handle.sandboxId });
  } catch {
    return { progress: 0, done: true, error: "Sandbox render kedaluwarsa" };
  }

  let command: Awaited<ReturnType<Sandbox["getCommand"]>>;
  try {
    command = await sandbox.getCommand(handle.commandId);
  } catch (error) {
    return {
      progress: 0,
      done: true,
      error: error instanceof Error ? error.message : "Gagal membaca perintah render",
    };
  }

  const buffer = await sandbox
    .readFileToBuffer({ path: "/vercel/sandbox/progress.json" })
    .catch(() => null);

  if (!buffer) {
    if (command.exitCode !== null && command.exitCode !== 0) {
      return { progress: 100, done: true, error: "Render gagal sebelum progres tercatat" };
    }
    return { progress: 0, done: false };
  }

  let payload: { stage?: string; overallProgress?: number; message?: string };
  try {
    payload = JSON.parse(buffer.toString("utf8")) as typeof payload;
  } catch {
    return { progress: 0, done: true, error: "File progres render rusak" };
  }

  const overall = typeof payload.overallProgress === "number" ? payload.overallProgress : 0;
  // Beberapa versi Remotion menulis 0..1, lainnya 0..100.
  const normalized = overall <= 1 ? overall * 100 : overall;
  const percent = Math.max(0, Math.min(100, Math.round(normalized)));

  if (command.exitCode !== null && command.exitCode !== 0) {
    return { progress: percent, done: true, error: payload.message ?? "Render gagal" };
  }
  if (payload.stage === "done") {
    return { progress: 100, done: true };
  }
  if (payload.stage === "error") {
    return { progress: percent, done: true, error: payload.message ?? "Render gagal" };
  }
  return { progress: percent, done: false };
}

/**
 * Ambil MP4 dari sandbox setelah render selesai lalu simpan ke storage lokal.
 * Dipanggil sekali oleh route polling saat status berubah menjadi `done`.
 */
export async function saveRenderedVideo(
  handle: RenderHandle,
  jobId: string,
): Promise<StoredObject> {
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.get({ name: handle.sandboxId });
  } catch {
    throw new Error("Sandbox render sudah kedaluwarsa sebelum MP4 diambil");
  }

  const buffer = await sandbox
    .readFileToBuffer({ path: handle.outputFile || "/tmp/video.mp4" })
    .catch(() => null);
  if (!buffer || buffer.byteLength < 1024) {
    throw new Error("MP4 hasil render tidak ditemukan di sandbox");
  }

  return putObject({
    data: buffer,
    filename: localRenderKey(jobId),
    contentType: "video/mp4",
    access: "public",
  });
}
