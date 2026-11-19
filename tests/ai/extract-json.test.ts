import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ai/pipeline";

describe("extractJson (pipeline AI)", () => {
  it("membaca JSON di dalam code fence ```json", () => {
    const raw = '```json\n{"schemaVersion":2,"title":"Uji Fence"}\n```';
    expect(extractJson(raw)).toEqual({ schemaVersion: 2, title: "Uji Fence" });
  });

  it("tahan terhadap teks di sekitar code fence", () => {
    const raw = 'Berikut rencananya:\n```json\n{"ok":true}\n```\nSemoga membantu.';
    expect(extractJson(raw)).toEqual({ ok: true });
  });

  it("membaca JSON polos yang diapit basa-basi", () => {
    expect(extractJson('Baik, ini hasilnya: {"total":3} Terima kasih.')).toEqual({ total: 3 });
  });
});
