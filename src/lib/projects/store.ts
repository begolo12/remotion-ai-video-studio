import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Project, ProjectSummary } from "../plan/schema";

const DATA_DIR = path.join(process.cwd(), "data", "projects");

const ensureDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const projectPath = (id: string) => path.join(DATA_DIR, `${id}.json`);

const isSafeId = (id: string) => /^[a-zA-Z0-9-]{1,64}$/.test(id);

/**
 * Project lama menyimpan URL `/renders/<file>`; sekarang file disajikan lewat
 * `/api/files/<file>` supaya MP4 baru (dibuat setelah server jalan) tidak 404.
 */
const migrate = (project: Project): Project => ({
  ...project,
  renders: (project.renders ?? []).map((render) => ({
    ...render,
    url: render.url?.startsWith("/renders/")
      ? render.url.replace("/renders/", "/api/files/")
      : render.url,
  })),
});

export const listProjects = async (): Promise<ProjectSummary[]> => {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const projects: Project[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
      projects.push(JSON.parse(raw) as Project);
    } catch {
      // file rusak diabaikan agar daftar tetap bisa dibuka
    }
  }

  return projects
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((project) => {
      const { plan, ...rest } = migrate(project);
      return {
        ...rest,
        planTitle: plan.title,
        sceneCount: plan.scenes.length,
      };
    });
};

export const getProject = async (id: string): Promise<Project | null> => {
  if (!isSafeId(id)) return null;
  try {
    const raw = await fs.readFile(projectPath(id), "utf8");
    return migrate(JSON.parse(raw) as Project);
  } catch {
    return null;
  }
};

export const saveProject = async (project: Project): Promise<Project> => {
  await ensureDir();
  await fs.writeFile(projectPath(project.id), JSON.stringify(project, null, 2), "utf8");
  return project;
};

export const deleteProject = async (id: string): Promise<boolean> => {
  if (!isSafeId(id)) return false;
  try {
    await fs.unlink(projectPath(id));
    return true;
  } catch {
    return false;
  }
};

export const createProjectId = () => randomUUID();
