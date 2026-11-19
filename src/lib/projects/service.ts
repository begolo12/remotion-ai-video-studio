import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  assets,
  projectRevisions,
  projects,
  renderArtifacts,
  renderJobs,
} from "@/lib/db/schema";
import type { VideoPlan } from "@/lib/plan/schema";
import { toLegacyPlan, type PlanV2 } from "@/lib/plan/v2";

export type StoredProject = {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  planV2: PlanV2;
  plan: VideoPlan;
  model: string;
  revisionId: string;
  revisionNumber: number;
};

export type CreateProjectInput = {
  workspaceId: string;
  createdBy: string;
  title: string;
  prompt: string;
  targetSeconds: number;
  styleId: string;
  model: string;
  planV2: PlanV2;
  /** Plan v1 yang sudah memuat audio URL dan word timing hasil TTS. */
  audioPlan?: VideoPlan;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "project";

type RevisionRow = typeof projectRevisions.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;

const currentRevision = async (projectId: string): Promise<RevisionRow | null> => {
  const [row] = await db
    .select()
    .from(projectRevisions)
    .where(eq(projectRevisions.projectId, projectId))
    .orderBy(desc(projectRevisions.revisionNumber))
    .limit(1);
  return row ?? null;
};

const assemble = (project: ProjectRow, revision: RevisionRow, model = ""): StoredProject => {
  const planV2 = revision.planJson as unknown as PlanV2;
  const plan = (revision.legacyPlanJson as VideoPlan | null) ?? toLegacyPlan(planV2);
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    title: project.title,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    planV2,
    plan,
    model,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
  };
};

export async function createProjectWithPlan(input: CreateProjectInput): Promise<StoredProject> {
  if (!isUuid(input.workspaceId) || !isUuid(input.createdBy)) {
    throw new Error("workspaceId atau createdBy tidak valid");
  }

  const id = randomUUID();
  const now = new Date();

  await db.insert(projects).values({
    id,
    workspaceId: input.workspaceId,
    title: input.title.slice(0, 100),
    slug: `${slugify(input.title)}-${id.slice(0, 8)}`,
    status: "ready",
    targetPlatform: input.planV2.targetPlatform,
    targetSeconds: input.targetSeconds,
    language: input.planV2.language,
    styleId: input.styleId,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  const planToStore: PlanV2 = {
    ...input.planV2,
    id,
    prompt: input.prompt,
    createdAt: input.planV2.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const [revision] = await db
    .insert(projectRevisions)
    .values({
      projectId: id,
      revisionNumber: 1,
      source: "ai_generated",
      planJson: planToStore,
      legacyPlanJson: input.audioPlan ?? null,
      changeSummary: "Storyboard awal dari AI",
      createdBy: input.createdBy,
      createdAt: now,
    })
    .returning();

  await db
    .update(projects)
    .set({ currentRevisionId: revision.id, updatedAt: now })
    .where(eq(projects.id, id));

  const [created] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!created) throw new Error("Gagal membuat project");
  return assemble(created, revision, input.model);
}

export async function listWorkspaceProjects(workspaceId: string): Promise<StoredProject[]> {
  if (!isUuid(workspaceId)) return [];
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));
  const result: StoredProject[] = [];
  for (const project of rows) {
    const revision = await currentRevision(project.id);
    if (revision) result.push(assemble(project, revision));
  }
  return result;
}

export async function getStoredProject(
  id: string,
  workspaceId?: string,
): Promise<StoredProject | null> {
  if (!isUuid(id)) return null;
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) return null;
  if (workspaceId && project.workspaceId !== workspaceId) return null;
  const revision = await currentRevision(id);
  if (!revision) return null;
  return assemble(project, revision);
}

export async function saveProjectRevision(input: {
  projectId: string;
  workspaceId: string;
  createdBy: string;
  planV2: PlanV2;
  audioPlan?: VideoPlan;
  source?: string;
  changeSummary?: string;
}): Promise<StoredProject> {
  const [projectRow] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!projectRow || (input.workspaceId && projectRow.workspaceId !== input.workspaceId)) {
    throw new Error("Project tidak ditemukan");
  }

  const current = await currentRevision(input.projectId);
  const now = new Date();
  const [revision] = await db
    .insert(projectRevisions)
    .values({
      projectId: input.projectId,
      revisionNumber: (current?.revisionNumber ?? 0) + 1,
      source: input.source ?? "manual_edit",
      planJson: { ...input.planV2, updatedAt: now.toISOString() },
      legacyPlanJson: input.audioPlan ?? null,
      changeSummary: input.changeSummary ?? null,
      createdBy: input.createdBy,
      createdAt: now,
    })
    .returning();

  await db
    .update(projects)
    .set({ currentRevisionId: revision.id, title: input.planV2.title.slice(0, 100), updatedAt: now })
    .where(eq(projects.id, input.projectId));

  return assemble(projectRow, revision);
}

export async function deleteStoredProject(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) return false;

  await db.delete(projectRevisions).where(eq(projectRevisions.projectId, id));

  const jobs = await db.select({ id: renderJobs.id }).from(renderJobs).where(eq(renderJobs.projectId, id));
  for (const job of jobs) {
    await db.delete(renderArtifacts).where(eq(renderArtifacts.jobId, job.id));
  }
  await db.delete(renderJobs).where(eq(renderJobs.projectId, id));
  await db.delete(assets).where(eq(assets.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  return true;
}
