import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ai/generate";
import { PlanValidationError } from "@/lib/plan/normalize";

describe("extractJson", () => {
  it("membaca JSON polos", () => {
    expect(extractJson('{"title":"A"}')).toEqual({ title: "A" });
  });

  it("membaca JSON di dalam code fence", () => {
    const raw = '```json\n{"title":"B","scenes":[]}\n```';
    expect(extractJson(raw)).toEqual({ title: "B", scenes: [] });
  });

  it("membaca JSON yang diapit basa-basi", () => {
    const raw = 'Tentu! Ini hasilnya:\n{"title":"C"}\nSemoga membantu.';
    expect(extractJson(raw)).toEqual({ title: "C" });
  });

  it("membungkus array scene menjadi objek", () => {
    const raw = '[{"template":"hook","heading":"Halo"}]';
    expect(extractJson(raw)).toEqual({ scenes: [{ template: "hook", heading: "Halo" }] });
  });

  it("melempar PlanValidationError bila tidak ada JSON", () => {
    expect(() => extractJson("maaf saya tidak bisa")).toThrow(PlanValidationError);
  });
});
