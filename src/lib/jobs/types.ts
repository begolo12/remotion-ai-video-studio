/** Status hidup sebuah job render, dari antrean sampai selesai. */
export type RenderStatus =
  | "queued"
  | "preparing"
  | "bundling"
  | "rendering"
  | "encoding"
  | "uploading"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

/** Baris `render_jobs` yang sudah dinormalisasi untuk dipakai lintas modul. */
export type RenderJobRecord = {
  id: string;
  projectId: string;
  revisionId: string | null;
  status: RenderStatus;
  stage: string | null;
  progress: number;
  attempt: number;
  priority: number;
  sandboxId: string | null;
  commandId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  workerId: string | null;
  claimedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EnqueueRenderInput = {
  projectId: string;
  revisionId: string;
  workspaceId: string;
  requestedBy: string;
  priority?: number;
};

export type ArtifactInput = {
  artifactType: "mp4" | "thumbnail" | "preview" | "subtitle" | "metadata";
  storageKey: string;
  url: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
};

export type JobErrorCode =
  | "AI_TIMEOUT"
  | "TTS_FAILED"
  | "ASSET_NOT_FOUND"
  | "BLOB_UPLOAD_FAILED"
  | "SANDBOX_EXPIRED"
  | "REMOTION_RENDER_FAILED"
  | "DATABASE_ERROR"
  | "CANCELLED";
