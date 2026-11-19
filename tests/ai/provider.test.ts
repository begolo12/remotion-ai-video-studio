import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError } from "@/lib/ai/errors";
import { inferhubProvider, setAiRunLogger } from "@/lib/ai/provider";

const SECRET = "sk-test-rahasia-jangan-muncul";
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("inferhubProvider", () => {
  beforeEach(() => {
    process.env.INFERHUB_API_KEY = SECRET;
    process.env.INFERHUB_BASE_URL = "https://api.inferhub.test/v1";
    process.env.INFERHUB_MODEL = "cx/gpt-6.2-sol";
    delete process.env.INFERHUB_FALLBACK_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setAiRunLogger(() => undefined);
    delete process.env.INFERHUB_API_KEY;
    delete process.env.INFERHUB_BASE_URL;
    delete process.env.INFERHUB_MODEL;
  });

  it("retry 429 lalu 200 → sukses dengan dua kali fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: '{"ok":true}' } }],
          model: "cx/gpt-6.2-sol",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const output = await inferhubProvider.chat({
      messages: [{ role: "user", content: "hai" }],
    });

    expect(output.content).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tidak memunculkan apiKey di pesan error maupun detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "denied" }, 403)));

    let caught: unknown;
    try {
      await inferhubProvider.chat({ messages: [{ role: "user", content: "hai" }] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AiProviderError);
    const failure = caught as AiProviderError;
    expect(failure.code).toBe("AUTH");
    expect(failure.message).not.toContain(SECRET);
    expect(failure.detail ?? "").not.toContain(SECRET);
  });

  it("mencatat run sukses lewat logger", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: "halo" } }],
          usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
        }),
      ),
    );
    const entries: Array<{ status: string; operation: string }> = [];
    setAiRunLogger((entry) => entries.push({ status: entry.status, operation: entry.operation }));

    await inferhubProvider.chat({
      messages: [{ role: "user", content: "hai" }],
      operation: "testOp",
    });

    expect(entries).toEqual([{ status: "success", operation: "testOp" }]);
  });
});
