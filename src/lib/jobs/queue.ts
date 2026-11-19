import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { renderArtifacts, renderJobs } from "@/lib/db/schema";
import type {
  ArtifactInput,
  EnqueueRenderInput,
  JobErrorCode,
  RenderJobRecord,
  RenderStatus,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validasi UUID sebelum query supaya Postgres tidak melempar error sintaks. */
function requireUuid(value: string, label: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`${label} bukan UUID yang valid`);
  }
  return value;
}

const ACTIVE_STATUSES: RenderStatus[] = [
  "preparing",
  "bundling",
  "rendering",
  "encoding",
  "uploading",
];

const CLAIMABLE_ERRORS: RenderStatus[] = ["failed", "cancelled", "expired"];

function toRecord(row: typeof renderJobs.$inferSelect): RenderJobRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    revisionId: row.revisionId,
    status: row.status as RenderStatus,
    stage: row.stage,
    progress: row.progress,
    attempt: row.attempt,
    priority: row.priority,
    sandboxId: row.sandboxId,
    commandId: row.commandId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    workerId: row.workerId,
    claimedAt: row.claimedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function enqueueRenderJob(input: EnqueueRenderInput): Promise<RenderJobRecord> {
  const projectId = requireUuid(input.projectId, "projectId");
  const revisionId = requireUuid(input.revisionId, "revisionId");
  // workspaceId/requestedBy dipakai untuk audit di pemanggil; tabel render_jobs
  // tidak menyimpan keduanya, tetapi tetap divalidasi supaya kontrak konsisten.
  requireUuid(input.workspaceId, "workspaceId");
  requireUuid(input.requestedBy, "requestedBy");

  const priority = Number.isFinite(input.priority) ? Math.trunc(input.priority as number) : 0;
  const [row] = await db
    .insert(renderJobs)
    .values({ projectId, revisionId, status: "queued", progress: 0, attempt: 0, priority })
    .returning();

  return toRecord(row);
}

export async function getRenderJob(id: string): Promise<RenderJobRecord | null> {
  requireUuid(id, "id");
  const [row] = await db.select().from(renderJobs).where(eq(renderJobs.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function listRenderJobs(projectId: string): Promise<RenderJobRecord[]> {
  requireUuid(projectId, "projectId");
  const rows = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.projectId, projectId))
    .orderBy(desc(renderJobs.createdAt));
  return rows.map(toRecord);
}

/**
 * Ambil satu job queued secara atomik. `FOR UPDATE SKIP LOCKED` mencegah dua
 * worker mengunci baris yang sama; UPDATE dengan WHERE status='queued' RETURNING
 * memastikan pemenangnya hanya satu.
 */
export async function claimRenderJob(workerId: string): Promise<RenderJobRecord | null> {
  if (!workerId || workerId.trim().length === 0) {
    throw new Error("workerId wajib diisi");
  }
  const now = new Date();
  const candidate = db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(eq(renderJobs.status, "queued"))
    .orderBy(desc(renderJobs.priority), asc(renderJobs.createdAt))
    .limit(1)
    .for("update", { skipLocked: true });

  const rows = await db
    .update(renderJobs)
    .set({
      status: "preparing",
      stage: "preparing",
      attempt: sql`${renderJobs.attempt} + 1`,
      workerId: workerId.trim(),
      claimedAt: now,
      startedAt: now,
      updatedAt: now,
    })
    .where(and(eq(renderJobs.status, "queued"), inArray(renderJobs.id, candidate)))
    .returning();

  return rows.length > 0 ? toRecord(rows[0]) : null;
}

export async function updateRenderJob(
  id: string,
  patch: Partial<
    Pick<
      RenderJobRecord,
      | "status"
      | "stage"
      | "progress"
      | "sandboxId"
      | "commandId"
      | "errorCode"
      | "errorMessage"
      | "startedAt"
      | "completedAt"
    >
  >,
): Promise<void> {
  requireUuid(id, "id");
  const values: Partial<typeof renderJobs.$inferInsert> = { updatedAt: new Date() };
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.stage !== undefined) values.stage = patch.stage;
  if (patch.progress !== undefined) values.progress = patch.progress;
  if (patch.sandboxId !== undefined) values.sandboxId = patch.sandboxId;
  if (patch.commandId !== undefined) values.commandId = patch.commandId;
  if (patch.errorCode !== undefined) values.errorCode = patch.errorCode;
  if (patch.errorMessage !== undefined) values.errorMessage = patch.errorMessage;
  if (patch.startedAt !== undefined) values.startedAt = patch.startedAt;
  if (patch.completedAt !== undefined) values.completedAt = patch.completedAt;

  await db.update(renderJobs).set(values).where(eq(renderJobs.id, id));
}

export async function completeRenderJob(id: string, artifacts: ArtifactInput[]): Promise<void> {
  requireUuid(id, "id");
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(renderJobs)
      .set({
        status: "completed",
        stage: "completed",
        progress: 100,
        errorCode: null,
        errorMessage: null,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(renderJobs.id, id));

    if (artifacts.length > 0) {
      await tx.insert(renderArtifacts).values(
        artifacts.map((artifact) => ({
          jobId: id,
          artifactType: artifact.artifactType,
          storageKey: artifact.storageKey,
          url: artifact.url,
          mimeType: artifact.mimeType,
          fileSize: artifact.fileSize,
          checksum: artifact.checksum ?? null,
          durationSeconds: artifact.durationSeconds ?? null,
          width: artifact.width ?? null,
          height: artifact.height ?? null,
          createdAt: now,
        })),
      );
    }
  });
}

export async function failRenderJob(
  id: string,
  error: { code: JobErrorCode; message: string },
): Promise<void> {
  requireUuid(id, "id");
  const now = new Date();
  await db
    .update(renderJobs)
    .set({
      status: "failed",
      stage: error.code,
      errorCode: error.code,
      errorMessage: error.message,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(renderJobs.id, id));
}

export async function retryRenderJob(id: string): Promise<RenderJobRecord> {
  requireUuid(id, "id");
  const current = await getRenderJob(id);
  if (!current) {
    throw new Error("Job tidak ditemukan");
  }
  if (!CLAIMABLE_ERRORS.includes(current.status)) {
    throw new Error(`Job dengan status ${current.status} tidak bisa diulang`);
  }

  const [row] = await db
    .update(renderJobs)
    .set({
      status: "queued",
      stage: null,
      progress: 0,
      errorCode: null,
      errorMessage: null,
      sandboxId: null,
      commandId: null,
      workerId: null,
      claimedAt: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(renderJobs.id, id))
    .returning();

  return toRecord(row);
}

export async function cancelRenderJob(id: string): Promise<void> {
  requireUuid(id, "id");
  const current = await getRenderJob(id);
  if (!current) {
    throw new Error("Job tidak ditemukan");
  }
  if (!ACTIVE_STATUSES.includes(current.status) && current.status !== "queued") {
    throw new Error(`Job dengan status ${current.status} tidak bisa dibatalkan`);
  }

  const now = new Date();
  await db
    .update(renderJobs)
    .set({
      status: "cancelled",
      stage: "cancelled",
      errorCode: "CANCELLED",
      errorMessage: "Dibatalkan oleh pengguna",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(renderJobs.id, id));
}

/**
 * Tandai job aktif yang worker-nya sudah lama tidak memberi kabar sebagai
 * SANDBOX_EXPIRED. Job `queued` sengaja tidak tersentuh: belum ada yang berjalan.
 */
export async function recoverStaleJobs(staleMs = 15 * 60 * 1000): Promise<number> {
  if (!Number.isFinite(staleMs) || staleMs <= 0) {
    throw new Error("staleMs harus angka positif");
  }
  const cutoff = new Date(Date.now() - staleMs);
  const now = new Date();

  const rows = await db
    .update(renderJobs)
    .set({
      status: "failed",
      stage: "SANDBOX_EXPIRED",
      errorCode: "SANDBOX_EXPIRED",
      errorMessage: "Worker atau sandbox kedaluwarsa sebelum job selesai",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(renderJobs.status, ACTIVE_STATUSES),
        lt(sql`coalesce(${renderJobs.claimedAt}, ${renderJobs.updatedAt})`, cutoff),
      ),
    )
    .returning({ id: renderJobs.id });

  return rows.length;
}
