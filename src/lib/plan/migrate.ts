import { planSchema, type StyleId, type VideoPlan } from "./schema";
import { fromLegacyPlan, planV2Schema, type PlanV2 } from "./v2";

const describeIssues = (error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string =>
  error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

export function isLegacyPlan(value: unknown): value is VideoPlan {
  return planSchema.safeParse(value).success;
}

export function isPlanV2(value: unknown): value is PlanV2 {
  return planV2Schema.safeParse(value).success;
}

/**
 * Terima hasil AI dalam format v2 maupun v1. v2 dipakai apa adanya; v1 diangkat
 * menjadi v2 agar seluruh pipeline berikutnya punya satu bentuk saja.
 */
export function normalizePlan(
  value: unknown,
  meta: { prompt: string; targetSeconds: number; styleId: StyleId; id?: string },
): PlanV2 {
  const v2 = planV2Schema.safeParse(value);
  if (v2.success) return v2.data;

  const v1 = planSchema.safeParse(value);
  if (v1.success) {
    return fromLegacyPlan(v1.data, { prompt: meta.prompt, id: meta.id });
  }

  throw new Error(
    `Rencana video tidak cocok dengan skema v2 maupun v1 (v2: ${describeIssues(
      v2.error,
    )}; v1: ${describeIssues(v1.error)})`,
  );
}
