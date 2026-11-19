import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectRender } from "../plan/schema";
import { getProject, saveProject } from "../projects/store";

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

type JobStore = Map<string, RenderJob>;

// Disimpan di globalThis supaya tidak hilang saat Next.js me-reload modul di dev.
const globalStore = globalThis as unknown as {
  __renderJobs?: JobStore;
  __renderQueue?: Promise<void>;
};
const jobs: JobStore = globalStore.__renderJobs ?? new Map<string, RenderJob>();
globalStore.__renderJobs = jobs;

/** Batas render paralel supaya CPU/RAM tidak habis saat banyak permintaan. */
const MAX_CONCURRENT = 2;
const running = () =>
  [...jobs.values()].filter((job) => job.status === "rendering" || job.status === "queued").length;

const waitForSlot = async (job: RenderJob, timeoutMs = 10 * 60 * 1000) => {
  const started = Date.now();
  while (running() > MAX_CONCURRENT) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Antrean render terlalu panjang, coba lagi nanti");
    }
    if (job.status === "error") return;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
};

const CLI = path.join(process.cwd(), "node_modules", "@remotion", "cli", "remotion-cli.js");
const ENTRY = path.join(process.cwd(), "remotion", "index.ts");
const OUT_DIR = path.join(process.cwd(), "public", "renders");
const PROPS_DIR = path.join(process.cwd(), "data", "props");

export const getJob = (id: string): RenderJob | null => jobs.get(id) ?? null;

const pushLog = (job: RenderJob, line: string) => {
  job.logs.push(line);
  if (job.logs.length > 120) job.logs.shift();
};

const trackProgress = (job: RenderJob, chunk: string) => {
  const rendered = /Rendered (\d+)\/(\d+)/.exec(chunk);
  if (rendered) {
    const done = Number(rendered[1]);
    const total = Number(rendered[2]);
    if (total > 0) job.progress = Math.min(94, Math.round((done / total) * 94));
  }
  const encoded = /Encoded (\d+)\/(\d+)/.exec(chunk);
  if (encoded) {
    const done = Number(encoded[1]);
    const total = Number(encoded[2]);
    if (total > 0) job.progress = Math.max(job.progress, 94 + Math.round((done / total) * 5));
  }
};

const updateProjectRender = async (job: RenderJob, patch: Partial<ProjectRender>) => {
  const project = await getProject(job.projectId);
  if (!project) return;
  const existing = project.renders.find((render) => render.id === job.id);
  if (existing) {
    Object.assign(existing, patch);
  } else {
    project.renders.unshift({
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      ...patch,
    });
  }
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
};

export const startRender = async (projectId: string): Promise<RenderJob> => {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} tidak ditemukan`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PROPS_DIR, { recursive: true });

  const id = randomUUID();
  const fileName = `${projectId}-${Date.now()}.mp4`;
  const outputPath = path.join(OUT_DIR, fileName);
  const propsPath = path.join(PROPS_DIR, `${id}.json`);

  const job: RenderJob = {
    id,
    projectId,
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
    logs: [],
  };
  jobs.set(id, job);
  await updateProjectRender(job, { status: "queued", progress: 0 });

  await fs.writeFile(propsPath, JSON.stringify({ plan: project.plan }), "utf8");

  try {
    await waitForSlot(job);
  } catch (error) {
    job.status = "error";
    job.message = error instanceof Error ? error.message : String(error);
    job.finishedAt = new Date().toISOString();
    await updateProjectRender(job, { status: "error", message: job.message });
    return job;
  }

  const args = [
    CLI,
    "render",
    ENTRY,
    "ShortVideo",
    outputPath,
    `--props=${propsPath}`,
    "--codec=h264",
    "--crf=18",
    "--concurrency=4",
    "--log=info",
    "--overwrite",
  ];

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "production" },
      windowsHide: true,
    });
  } catch (error) {
    job.status = "error";
    job.message = error instanceof Error ? error.message : String(error);
    await updateProjectRender(job, { status: "error", message: job.message });
    return job;
  }

  job.status = "rendering";
  job.progress = 1;
  await updateProjectRender(job, { status: "rendering", progress: 1 });

  const onChunk = (buffer: Buffer) => {
    const text = buffer.toString();
    for (const line of text.split(/\r?\n/)) {
      const clean = line.replace(/\u001b\[[0-9;]*m/g, "").trim();
      if (!clean) continue;
      pushLog(job, clean);
      trackProgress(job, clean);
    }
  };

  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);

  child.on("close", async (code) => {
    // File props tidak dibutuhkan lagi setelah proses selesai.
    void fs.rm(propsPath, { force: true }).catch(() => undefined);

    if (code === 0) {
      job.status = "done";
      job.progress = 100;
      job.url = `/api/files/${fileName}`;
      job.file = outputPath;
      job.finishedAt = new Date().toISOString();
      await updateProjectRender(job, {
        status: "done",
        progress: 100,
        url: job.url,
        file: job.file,
        finishedAt: job.finishedAt,
      });
    } else {
      job.status = "error";
      job.message = `Remotion keluar dengan kode ${code}. ${job.logs.slice(-3).join(" | ")}`;
      job.finishedAt = new Date().toISOString();
      await updateProjectRender(job, {
        status: "error",
        message: job.message,
        finishedAt: job.finishedAt,
      });
    }
  });

  child.on("error", async (error) => {
    void fs.rm(propsPath, { force: true }).catch(() => undefined);
    job.status = "error";
    job.message = error.message;
    job.finishedAt = new Date().toISOString();
    await updateProjectRender(job, { status: "error", message: error.message });
  });

  return job;
};
