import { NextResponse } from "next/server";
import { inferhubProvider } from "@/lib/ai/provider";
import { AiProviderError } from "@/lib/ai/errors";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const model = process.env.INFERHUB_MODEL ?? "cx/gpt-6.2-sol";
const baseUrl = (process.env.INFERHUB_BASE_URL ?? "https://api.inferhub.dev/v1").replace(/\/+$/, "");

export async function GET() {
  const checks: {
    database: { ok: boolean; error?: string };
    ai: { ok: boolean; model: string; modelAvailable?: boolean; totalModels?: number; error?: string };
  } = {
    database: { ok: false },
    ai: { ok: false, model },
  };

  try {
    await db.execute(sql`select 1`);
    checks.database.ok = true;
  } catch (error) {
    checks.database.error = error instanceof Error ? error.message : String(error);
  }

  try {
    const models = await inferhubProvider.listModels();
    checks.ai.ok = true;
    checks.ai.modelAvailable = models.includes(model);
    checks.ai.totalModels = models.length;
    if (!checks.ai.modelAvailable) {
      checks.ai.error = `Model ${model} tidak ditemukan di daftar provider`;
    }
  } catch (error) {
    checks.ai.error =
      error instanceof AiProviderError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
  }

  const ok = checks.database.ok && checks.ai.ok && checks.ai.modelAvailable === true;

  return NextResponse.json(
    {
      ok,
      baseUrl,
      model,
      fallbackModel: process.env.INFERHUB_FALLBACK_MODEL ?? "",
      modelAvailable: checks.ai.modelAvailable ?? false,
      totalModels: checks.ai.totalModels ?? 0,
      error: checks.ai.error ?? checks.database.error,
      checks,
      runtime: "nodejs",
      region: process.env.VERCEL_REGION ?? "local",
    },
    { status: ok ? 200 : 503 },
  );
}
