import { describe, expect, it } from "vitest";
import { checkExportReadiness } from "@/lib/render/checklist";
import type { PlanV2, V2Scene } from "@/lib/plan/v2";

const scene = (overrides: Partial<V2Scene> = {}): V2Scene =>
  ({
    id: "s1",
    order: 1,
    type: "hook",
    purpose: "menarik perhatian",
    visual: "factory",
    durationSeconds: 4,
    heading: "Dari kilang ke motormu",
    narration: "Perjalanan minyak dimulai dari kilang.",
    caption: "Dari kilang ke motormu",
    visualDirection: "Close up kilang",
    camera: "push-in",
    transitionIn: "fade",
    assetBrief: {
      subject: "kilang",
      composition: "center",
      lighting: "soft",
      mood: "industrial",
      aspectRatio: "9:16",
    },
    assetRefs: ["asset-1"],
    weight: 1,
    ...overrides,
  }) as V2Scene;

const plan = (scenes: V2Scene[]): PlanV2 =>
  ({
    schemaVersion: 2,
    id: "plan-1",
    title: "Perjalanan BBM",
    prompt: "Jelaskan perjalanan BBM",
    language: "id",
    audience: "umum",
    tone: "edukatif",
    targetPlatform: "youtube-shorts",
    targetSeconds: 30,
    styleId: "cinematic",
    styleBible: {
      palette: ["#000", "#fff"],
      typography: "sans",
      captionStyle: "bold",
      backgroundStyle: "dark",
      cameraLanguage: "push-in",
      transitionLanguage: "fade",
      visualDensity: "medium",
      lighting: "soft",
      texture: "clean",
      prohibitedPatterns: [],
    },
    hook: "Tahukah kamu?",
    keyMessage: "BBM punya perjalanan panjang",
    scenes,
    outro: { heading: "Selesai", cta: "Ikuti channel kami" },
    publishing: {
      title: "Perjalanan BBM",
      description: "Edukasi",
      hashtags: [],
      pinnedComment: "",
      thumbnailText: "BBM",
    },
    quality: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }) as unknown as PlanV2;

const narration = { enabled: true, scenes: 1 };

describe("checkExportReadiness", () => {
  it("menandai scene tanpa narasi sebagai error", () => {
    const checks = checkExportReadiness(plan([scene({ narration: "" })]), { narration });
    const failed = checks.filter((c) => !c.passed && c.severity === "error");
    expect(failed.some((c) => c.code === "SCENE_NARRATION")).toBe(true);
  });

  it("menandai caption lebih dari 6 kata sebagai warning", () => {
    const checks = checkExportReadiness(
      plan([scene({ caption: "satu dua tiga empat lima enam tujuh delapan" })]),
      { narration },
    );
    const caption = checks.find((c) => c.code === "CAPTION_LENGTH");
    expect(caption).toMatchObject({ passed: false, severity: "warning" });
    expect(caption?.detail).toContain("8");
  });

  it("tidak menghasilkan error untuk plan yang valid", () => {
    const checks = checkExportReadiness(plan([scene()]), { narration });
    expect(checks.filter((c) => !c.passed && c.severity === "error")).toHaveLength(0);
  });

  it("memberi warning bila status narasi belum diputuskan", () => {
    const checks = checkExportReadiness(plan([scene()]), {});
    expect(checks.find((c) => c.code === "NARRATION_MODE")).toMatchObject({
      passed: false,
      severity: "warning",
    });
  });

  it("menolak scene berdurasi di bawah 2 detik", () => {
    const checks = checkExportReadiness(plan([scene({ durationSeconds: 1 })]), { narration });
    expect(checks.find((c) => c.code === "SCENE_DURATION")?.passed).toBe(false);
  });
});
