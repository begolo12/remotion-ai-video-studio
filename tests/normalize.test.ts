import { describe, expect, it } from "vitest";
import { PlanValidationError, normalizePlan } from "@/lib/plan/normalize";

describe("normalizePlan", () => {
  it("menerima keluaran AI yang valid apa adanya", () => {
    const plan = normalizePlan(
      {
        version: 1,
        title: "Rahasia Fokus",
        hook: "Kenapa fokusmu hilang?",
        styleId: "neon",
        targetSeconds: 45,
        scenes: [
          { template: "hook", heading: "Fokusmu hilang", narration: "Pembuka" },
          { template: "bullets", heading: "Tiga penyebab", bullets: ["HP", "Notifikasi", "Multitask"] },
        ],
        outro: { heading: "Coba sekarang", cta: "Simpan video ini" },
        caption: "Caption contoh",
        hashtags: ["#shorts"],
      },
      { styleId: "cinematic", targetSeconds: 45 },
    );

    expect(plan.styleId).toBe("neon");
    expect(plan.targetSeconds).toBe(45);
    expect(plan.scenes).toHaveLength(2);
    expect(plan.outro.cta).toBe("Simpan video ini");
  });

  it("merapikan key alternatif, template asing, dan teks kepanjangan", () => {
    const longHeading = "A".repeat(300);
    const plan = normalizePlan(
      {
        title: "Judul",
        hook: "Hook",
        blocks: [
          { template: "unknown-template", title: longHeading, body: "Isi" },
          { template: "bullets", title: "Poin", points: ["satu", 2, "tiga"] },
        ],
        cta: { title: "Penutup", text: "Ikuti" },
        tags: ["#a", "#b"],
      },
      { styleId: "bold", targetSeconds: 999 },
    );

    expect(plan.scenes[0].template).toBe("statement");
    expect(plan.scenes[0].heading).toHaveLength(90);
    expect(plan.scenes[1].bullets).toEqual(["satu", "2", "tiga"]);
    expect(plan.targetSeconds).toBe(180);
    expect(plan.hashtags).toEqual(["#a", "#b"]);
    expect(plan.outro.heading).toBe("Penutup");
  });

  it("membuat scene hook bila AI tidak mengirim scene", () => {
    const plan = normalizePlan(
      { title: "Kosong", hook: "Hanya hook" },
      { styleId: "minimal", targetSeconds: 30 },
    );

    expect(plan.scenes).toHaveLength(1);
    expect(plan.scenes[0].template).toBe("hook");
    expect(plan.scenes[0].heading).toBe("Hanya hook");
    // Narasi diwarisi dari hook supaya voice over tidak kosong.
    expect(plan.narration).toEqual(["Hanya hook"]);
  });

  it("melempar PlanValidationError untuk input bukan objek", () => {
    expect(() => normalizePlan("bukan json", { styleId: "retro", targetSeconds: 30 })).toThrow(
      PlanValidationError,
    );
  });
});
