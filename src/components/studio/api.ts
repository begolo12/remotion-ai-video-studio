import type {
  Project,
  ProjectSummary,
  StyleId,
  VideoPlan,
} from "@/lib/plan/schema";
import type { PlanV2 } from "@/lib/plan/v2";

export type HealthResponse = {
  ok: boolean;
  baseUrl: string;
  model: string;
  fallbackModel?: string;
  modelAvailable?: boolean;
  fallbackAvailable?: boolean;
  totalModels?: number;
  error?: string;
};

export type GenerateInput = {
  description: string;
  targetSeconds: number;
  styleId: StyleId;
  model?: string;
  voice?: "male" | "female";
  withNarration?: boolean;
};

export type GenerateResponse = {
  project: Project;
  plan: VideoPlan;
  model: string;
  fellBack: boolean;
  narration?: {
    enabled: boolean;
    voice: string;
    scenes: number;
    totalSeconds: number;
    error?: string;
  };
  planV2?: PlanV2;
  log: string[];
};

export type StudioProjectResponse = {
  project: Project;
  planV2: PlanV2 | null;
  revision: number;
};

export type RenderJob = {
  id: string;
  projectId: string;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  message?: string;
  url?: string;
  file?: string;
  createdAt: string;
  finishedAt?: string;
  logs: string[];
};

type ApiErrorOptions = {
  status?: number;
  detail?: string;
  issues?: string[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly issues: string[];

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.detail = options.detail;
    this.issues = options.issues ?? [];
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asOptionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const issuesFrom = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((issue) => {
      if (typeof issue === "string") return issue;
      if (!isRecord(issue)) return "";
      const path = asString(issue.path);
      const message = asString(issue.message);
      if (path && message) return `${path}: ${message}`;
      return message || path;
    })
    .filter((line) => line.length > 0);
};

const toApiError = (
  body: unknown,
  status: number,
  fallbackMessage: string,
): ApiError => {
  const record = isRecord(body) ? body : {};
  const message = asOptionalString(record.error) ?? fallbackMessage;
  return new ApiError(message, {
    status,
    detail: asOptionalString(record.detail),
    issues: issuesFrom(record.issues),
  });
};

const request = async (
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; body: unknown }> => {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(
      "Tidak bisa menghubungi server. Pastikan aplikasi berjalan lalu coba lagi.",
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { response, body } = await request("/api/health");
  const record = isRecord(body) ? body : {};
  return {
    ok: response.ok && record.ok === true,
    baseUrl: asString(record.baseUrl),
    model: asString(record.model),
    fallbackModel: asOptionalString(record.fallbackModel),
    modelAvailable: asOptionalBoolean(record.modelAvailable),
    fallbackAvailable: asOptionalBoolean(record.fallbackAvailable),
    totalModels:
      typeof record.totalModels === "number" ? record.totalModels : undefined,
    error: asOptionalString(record.error),
  };
};

export const generateVideo = async (
  input: GenerateInput,
): Promise<GenerateResponse> => {
  const { response, body } = await request("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal membuat skenario video.");
  }

  const record = isRecord(body) ? body : {};
  if (!isRecord(record.project) || !isRecord(record.plan)) {
    throw new ApiError("Respons server tidak sesuai. Coba lagi.", {
      status: response.status,
    });
  }
  return body as GenerateResponse;
};

export const fetchProjects = async (): Promise<ProjectSummary[]> => {
  const { response, body } = await request("/api/projects");
  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal memuat daftar project.");
  }
  const record = isRecord(body) ? body : {};
  if (!Array.isArray(record.projects)) {
    throw new ApiError("Daftar project tidak dikenali.", {
      status: response.status,
    });
  }
  return record.projects as ProjectSummary[];
};

export const fetchProject = async (id: string): Promise<Project> => {
  const { response, body } = await request(
    `/api/projects/${encodeURIComponent(id)}`,
  );
  if (!response.ok) {
    throw toApiError(body, response.status, "Project tidak ditemukan.");
  }
  const record = isRecord(body) ? body : {};
  if (!isRecord(record.project)) {
    throw new ApiError("Data project tidak dikenali.", {
      status: response.status,
    });
  }
  return record.project as unknown as Project;
};

export const fetchStudioProject = async (id: string): Promise<StudioProjectResponse> => {
  const { response, body } = await request(
    `/api/projects/${encodeURIComponent(id)}`,
  );
  if (!response.ok) {
    throw toApiError(body, response.status, "Project tidak ditemukan.");
  }
  const record = isRecord(body) ? body : {};
  if (!isRecord(record.project)) {
    throw new ApiError("Data project tidak dikenali.", { status: response.status });
  }
  return {
    project: record.project as unknown as Project,
    planV2: isRecord(record.planV2) ? (record.planV2 as unknown as PlanV2) : null,
    revision: typeof record.revision === "number" ? record.revision : 1,
  };
};

export const saveStoryboard = async (
  projectId: string,
  planV2: PlanV2,
): Promise<{ planV2: PlanV2; revision: number }> => {
  const { response, body } = await request(
    `/api/projects/${encodeURIComponent(projectId)}/storyboard`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planV2 }),
    },
  );
  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal menyimpan storyboard.");
  }
  const record = isRecord(body) ? body : {};
  return {
    planV2: (record.planV2 as PlanV2) ?? planV2,
    revision: typeof record.revision === "number" ? record.revision : 1,
  };
};

export const regenerateScene = async (
  projectId: string,
  sceneId: string,
  instruction: string,
): Promise<{ scene: unknown; planV2: PlanV2; revision: number }> => {
  const { response, body } = await request("/api/ai/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, sceneId, instruction }),
  });
  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal meregenerasi scene.");
  }
  const record = isRecord(body) ? body : {};
  return {
    scene: record.scene,
    planV2: (record.planV2 as PlanV2) ?? (await fetchStudioProject(projectId)).planV2!,
    revision: typeof record.revision === "number" ? record.revision : 1,
  };
};

export const reviewStoryboard = async (
  projectId: string,
): Promise<{ issues: unknown[]; revision: number }> => {
  const { response, body } = await request("/api/ai/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal memeriksa kualitas.");
  }
  const record = isRecord(body) ? body : {};
  return {
    issues: Array.isArray(record.issues) ? record.issues : [],
    revision: typeof record.revision === "number" ? record.revision : 1,
  };
};

export const removeProject = async (id: string): Promise<void> => {
  const { response, body } = await request(
    `/api/projects/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal menghapus project.");
  }
};

const toRenderJob = (value: unknown): RenderJob | null => {
  if (!isRecord(value)) return null;
  const status = value.status;
  if (
    status !== "queued" &&
    status !== "rendering" &&
    status !== "done" &&
    status !== "error"
  ) {
    return null;
  }
  return {
    id: asString(value.id),
    projectId: asString(value.projectId),
    status,
    progress: typeof value.progress === "number" ? value.progress : 0,
    message: asOptionalString(value.message),
    url: asOptionalString(value.url),
    file: asOptionalString(value.file),
    createdAt: asString(value.createdAt),
    finishedAt: asOptionalString(value.finishedAt),
    logs: Array.isArray(value.logs)
      ? value.logs.filter((line): line is string => typeof line === "string")
      : [],
  };
};

const jobFromBody = (body: unknown, status: number): RenderJob => {
  const record = isRecord(body) ? body : {};
  const job = toRenderJob(record.job);
  if (!job) {
    throw new ApiError("Job render tidak dikenali.", { status });
  }
  return job;
};

export const startRender = async (projectId: string): Promise<RenderJob> => {
  const { response, body } = await request("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!response.ok) {
    throw toApiError(body, response.status, "Gagal memulai render.");
  }
  return jobFromBody(body, response.status);
};

export const fetchRenderJob = async (jobId: string): Promise<RenderJob> => {
  const { response, body } = await request(
    `/api/render/${encodeURIComponent(jobId)}`,
  );
  if (!response.ok) {
    throw toApiError(body, response.status, "Job render tidak ditemukan.");
  }
  return jobFromBody(body, response.status);
};
