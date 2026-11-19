import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiRuns, usageEvents } from "@/lib/db/schema";
import { setAiRunLogger, type AiRunEntry } from "@/lib/ai/provider";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Menghubungkan pemanggilan AI ke tabel aiRuns dan usageEvents.
 * Dipanggil sekali saat modul server dimuat.
 */
export function installAiRunLogger(context: {
  workspaceId: string;
  userId: string;
  projectId?: string;
  sceneId?: string;
}): void {
  const { workspaceId, userId, projectId, sceneId } = context;

  setAiRunLogger(async (entry: AiRunEntry) => {
    if (!isUuid(workspaceId) || !isUuid(userId)) return;

    await db.insert(aiRuns).values({
      workspaceId,
      projectId: projectId && isUuid(projectId) ? projectId : null,
      sceneId: sceneId && isUuid(sceneId) ? sceneId : null,
      operation: entry.operation,
      provider: entry.provider,
      model: entry.model,
      requestHash: entry.requestHash ?? null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      latencyMs: entry.latencyMs ?? null,
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      errorMessage: null,
    });

    const total = (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0);
    if (total > 0) {
      await db.insert(usageEvents).values({
        workspaceId,
        userId,
        eventType: "ai_tokens",
        provider: entry.provider,
        quantity: String(total),
        unit: "tokens",
        metadataJson: { operation: entry.operation, model: entry.model },
      });
    }
  });
}

/** Membersihkan logger agar request berikutnya tidak memakai context lama. */
export function clearAiRunLogger(): void {
  setAiRunLogger(async () => undefined);
}

export async function countAiRuns(workspaceId: string): Promise<number> {
  const rows = await db.select({ id: aiRuns.id }).from(aiRuns).where(eq(aiRuns.workspaceId, workspaceId));
  return rows.length;
}
