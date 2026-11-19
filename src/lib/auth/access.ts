import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  workspaces,
  workspaceMembers,
  type Role,
  type User,
} from "@/lib/db/schema";
import { getSessionUser } from "./session";

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: number = 401,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

const RANKS: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function roleRank(role: Role): number {
  return RANKS[role];
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new AccessError("Belum login", 401);
  return user;
}

export async function requireWorkspace(
  workspaceId: string,
  minimumRole: Role = "viewer",
): Promise<typeof workspaces.$inferSelect> {
  const user = await requireUser();
  const rows = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  const membership = rows[0];
  if (!membership) {
    throw new AccessError("Workspace tidak ditemukan atau Anda bukan anggota", 403);
  }
  if (roleRank(membership.role as Role) < roleRank(minimumRole)) {
    throw new AccessError("Peran tidak mencukupi untuk aksi ini", 403);
  }
  return membership.workspace;
}

export async function ensurePersonalWorkspace(
  userId: string,
): Promise<typeof workspaces.$inferSelect> {
  const slug = `personal-${userId}`;
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(workspaces)
    .values({ name: "Personal Workspace", slug, ownerId: userId })
    .onConflictDoNothing({ target: workspaces.slug })
    .returning();

  const workspace =
    inserted[0] ??
    (
      await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1)
    )[0];

  if (!workspace) throw new Error("Gagal membuat workspace personal");

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId, role: "owner" })
    .onConflictDoNothing({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
    });

  return workspace;
}
