export type RouterConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel: string;
};

export const getRouterConfig = (): RouterConfig => {
  const baseUrl = (process.env.NINE_ROUTER_BASE_URL ?? "http://127.0.0.1:20128/v1").replace(
    /\/+$/,
    "",
  );
  const apiKey = process.env.NINE_ROUTER_API_KEY ?? "";
  const model = process.env.NINE_ROUTER_MODEL ?? "d/standar";
  const fallbackModel = process.env.NINE_ROUTER_FALLBACK_MODEL ?? "infer/cb/deepseek-v4.1-flash";
  return { baseUrl, apiKey, model, fallbackModel };
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  content: string;
  reasoning?: string;
  model: string;
  usage?: Record<string, unknown>;
};

export class RouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "RouterError";
  }
}

type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

/** Satu panggilan chat completion ke 9Router ([OI]-compatible). */
export const chatCompletion = async ({
  model,
  messages,
  temperature = 0.7,
  maxTokens = 6000,
  timeoutMs = 180_000,
}: ChatOptions): Promise<ChatResult> => {
  const { baseUrl, apiKey } = getRouterConfig();
  if (!apiKey) {
    throw new RouterError("NINE_ROUTER_API_KEY belum diisi di .env.local");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new RouterError(
        `9Router menolak permintaan untuk model ${model}`,
        response.status,
        text.slice(0, 500),
      );
    }

    let payload: {
      choices?: Array<{
        message?: { content?: string | null; reasoning_content?: string | null };
      }>;
      usage?: Record<string, unknown>;
    };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new RouterError("Respons 9Router bukan JSON", response.status, text.slice(0, 500));
    }

    const message = payload.choices?.[0]?.message;
    const content = message?.content ?? "";
    const reasoning = message?.reasoning_content ?? undefined;
    if (!content && !reasoning) {
      throw new RouterError("9Router mengembalikan jawaban kosong", response.status);
    }

    return { content, reasoning, model, usage: payload.usage };
  } catch (error) {
    if (error instanceof RouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RouterError(`Timeout ${Math.round(timeoutMs / 1000)}s menunggu model ${model}`);
    }
    throw new RouterError(
      `Gagal menghubungi 9Router di ${baseUrl}`,
      undefined,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
};

/** Daftar model yang tersedia di 9Router (untuk UI/diagnostik). */
export const listModels = async (): Promise<string[]> => {
  const { baseUrl, apiKey } = getRouterConfig();
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new RouterError("Gagal mengambil daftar model", response.status);
  }
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return (payload.data ?? []).map((item) => item.id ?? "").filter(Boolean);
};
