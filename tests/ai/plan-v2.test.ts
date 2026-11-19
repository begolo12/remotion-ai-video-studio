import { describe, expect, it } from "vitest";
import { isLegacyPlan, isPlanV2, normalizePlan } from "@/lib/plan/migrate";
import { planSchema, type VideoPlan } from "@/lib/plan/schema";
import { createEmptyPlanV2, fromLegacyPlan, planV2Schema, toLegacyPlan } from "@/lib/plan/v2";

const legacy: VideoPlan = {
  version: 1,
  title: "Judul Asli",
  hook: "Hook asli?",
  styleId: "neon",
  targetSeconds: 30,
  scenes: [
    { template: "hook", visual: "person", heading: "Halo", narration: "apakah kamu tahu", weight: 1 },
    {
      template: "bullets",
      visual: "chart",
      heading: "Poin penting",
      bullets: ["Satu", "Dua"],
      narration: "dua poin penting",
      weight: 1,
    },
  ],
  outro: { heading: "Simpan", cta: "Ikuti" },
  caption: "Caption asli",
  hashtags: ["#shorts"],
  narration: [],
};

const meta = { prompt: "Ide asli user", targetSeconds: 30, styleId: "neon" as const };

describe("konversi VideoPlan v2 <-> v1", () => {
  it("toLegacyPlan menghasilkan VideoPlan yang lolos planSchema", () => {
    const v2 = createEmptyPlanV2({ prompt: "Ide uji", targetSeconds: 30, styleId: "cinematic" });
    const result = toLegacyPlan(v2);
    expect(planSchema.safeParse(result).success).toBe(true);
  });

  it("fromLegacyPlan → toLegacyPlan tidak kehilangan judul, hook, dan styleId", () => {
    const v2 = fromLegacyPlan(legacy, { prompt: meta.prompt });
    const back = toLegacyPlan(v2);
    expect(back.title).toBe("Judul Asli");
    expect(back.hook).toBe("Hook asli?");
    expect(back.styleId).toBe("neon");
    expect(planSchema.safeParse(back).success).toBe(true);
  });

  it("quality dengan nama field berbeda tetap dinormalisasi", () => {
    const plan = createEmptyPlanV2({ prompt: "Ide uji", targetSeconds: 30, styleId: "cinematic" });
    const raw = {
      ...plan,
      quality: [
        { type: "caption", text: "Caption terlalu panjang", level: "warning" },
        { code: "hook", severity: "error", message: "Hook lemah" },
        { unknown: "dibuang" },
      ],
    };
    const parsed = planV2Schema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quality).toHaveLength(2);
      expect(parsed.data.quality[0]).toMatchObject({ severity: "warning" });
      expect(parsed.data.quality[1].code).toBe("hook");
    }
  });

  it("normalizePlan menerima rencana v1 maupun v2", () => {
    const fromV1 = normalizePlan(legacy, meta);
    const asV2 = fromLegacyPlan(legacy, { prompt: meta.prompt });
    const fromV2 = normalizePlan(asV2, meta);

    expect(isLegacyPlan(legacy)).toBe(true);
    expect(isPlanV2(asV2)).toBe(true);
    expect(isPlanV2(fromV1)).toBe(true);
    expect(isPlanV2(fromV2)).toBe(true);
    expect(fromV1.title).toBe("Judul Asli");
    expect(fromV2.styleId).toBe("neon");
  });
});
