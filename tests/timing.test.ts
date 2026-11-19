import { describe, expect, it } from "vitest";
import { FPS } from "@/lib/plan/schema";
import { computeSceneTimings, totalFramesFor } from "@/lib/plan/timing";
import { SAMPLE_PLAN } from "@/video/sample-plan";

describe("timing", () => {
  it("total frame = durasi target x fps", () => {
    expect(totalFramesFor(SAMPLE_PLAN)).toBe(30 * FPS);
  });

  it("jumlah durasi semua scene sama persis dengan total frame", () => {
    const timings = computeSceneTimings(SAMPLE_PLAN);
    const sum = timings.reduce((total, item) => total + item.durationInFrames, 0);
    expect(sum).toBe(totalFramesFor(SAMPLE_PLAN));
    expect(timings.at(-1)?.from).toBe(sum - (timings.at(-1)?.durationInFrames ?? 0));
  });

  it("scene terakhir selalu outro dan tidak ada celah antar scene", () => {
    const timings = computeSceneTimings(SAMPLE_PLAN);
    expect(timings.at(-1)?.scene.template).toBe("outro");

    let cursor = 0;
    for (const item of timings) {
      expect(item.from).toBe(cursor);
      expect(item.durationInFrames).toBeGreaterThan(0);
      cursor += item.durationInFrames;
    }
  });

  it("scene berbobot lebih besar mendapat durasi lebih panjang", () => {
    const timings = computeSceneTimings(SAMPLE_PLAN);
    const hook = timings[0];
    const bullets = timings[1];
    expect(bullets.durationInFrames).toBeGreaterThan(hook.durationInFrames);
  });
});
