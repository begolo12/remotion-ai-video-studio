import { AiProviderError } from "./errors";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatInput = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
  jsonMode?: boolean;
  /** Dipakai pipeline untuk telemetri; tidak pernah dikirim ke provider. */
  operation?: string;
  context?: { userId?: string; workspaceId?: string; projectId?: string };
};

export type ChatOutput = {
  content: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
};

export interface AiProvider {
  readonly name: string;
  chat(input: ChatInput): Promise<ChatOutput>;
  listModels(): Promise<string[]>;
}

export type AiRunEntry = {
  operation: string;
  provider: string;
  model: string;
  status: "success" | "error";
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  errorCode?: string;
  requestHash?: string;
};

export type AiRunLogger = (entry: AiRunEntry) => void;

let runLogger: AiRunLogger = () => undefined;

/** Pasang logger telemetri (default no-op). */
export const setAiRunLogger = (fn: AiRunLogger): void => {
  runLogger = fn;
};

type InferhubConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel: string;
};

const getConfig = (): InferhubConfig => ({
  baseUrl: (process.env.INFERHUB_BASE_URL ?? "https://api.inferhub.dev/v1").replace(/\/+$/, ""),
  apiKey: process.env.INFERHUB_API_KEY ?? "",
  model: process.env.INFERHUB_MODEL ?? "cx/gpt-6.2-sol",
  fallbackModel: process.env.INFERHUB_FALLBACK_MODEL ?? "",
});

/** Kredensial tidak boleh bocor lewat pesan error maupun detail respons. */
const redact = (text: string, apiKey: string): string => {
  let safe = text;
  if (apiKey) safe = safe.split(apiKey).join("[REDACTED]");
  return safe.slice(0, 500);
};

/** Hash ringan untuk menghubungkan log tanpa menyimpan prompt mentah. */
const hashRequest = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const RETRY_DELAY_MS = [500, 1500] as const;
const MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 180_000;

const errorFromStatus = (
  status: number,
  bodyText: string,
  model: string,
  cfg: InferhubConfig,
): AiProviderError => {
  const detail = redact(bodyText, cfg.apiKey);
  if (status === 401 || status === 403) {
    return new AiProviderError("Autentikasi InferHub ditolak", {
      code: "AUTH",
      status,
      retryable: false,
      detail,
    });
  }
  if (status === 429) {
    return new AiProviderError("InferHub membatasi permintaan (rate limit)", {
      code: "RATE_LIMIT",
      status,
      retryable: true,
      detail,
    });
  }
  if (status === 404) {
    return new AiProviderError(`Model ${model} tidak tersedia di InferHub`, {
      code: "MODEL_UNAVAILABLE",
      status,
      retryable: true,
      detail,
    });
  }
  if (status >= 500) {
    return new AiProviderError("InferHub mengalami gangguan sementara", {
      code: "NETWORK",
      status,
      retryable: true,
      detail,
    });
  }
  return new AiProviderError(`InferHub menolak permintaan (HTTP ${status})`, {
    code: "UNKNOWN",
    status,
    retryable: false,
    detail,
  });
};

type CompletionPayload = {
  choices?: Array<{
    message?: { content?: string | null; reasoning_content?: string | null };
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const parseCompletion = (text: string, model: string, cfg: InferhubConfig): ChatOutput => {
  let payload: CompletionPayload;
  try {
    payload = JSON.parse(text) as CompletionPayload;
  } catch {
    throw new AiProviderError("Respons InferHub bukan JSON yang valid", {
      code: "INVALID_JSON",
      retryable: false,
      detail: redact(text, cfg.apiKey),
    });
  }

  const message = payload.choices?.[0]?.message;
  const content = message?.content ?? message?.reasoning_content ?? "";
  if (!content.trim()) {
    throw new AiProviderError("InferHub mengembalikan jawaban kosong", {
      code: "EMPTY_RESPONSE",
      retryable: false,
    });
  }
  return {
    content,
    model: payload.model ?? model,
    usage: payload.usage
      ? {
          promptTokens: payload.usage.prompt_tokens,
          completionTokens: payload.usage.completion_tokens,
          totalTokens: payload.usage.total_tokens,
        }
      : undefined,
  };
};

/** Kirim satu request. `withResponseFormat` bisa dimatikan bila provider menolak json_mode. */
const postChat = async (
  cfg: InferhubConfig,
  model: string,
  input: ChatInput,
  withResponseFormat: boolean,
): Promise<ChatOutput> => {
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 6000,
      stream: false,
    };
    if (withResponseFormat) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw errorFromStatus(response.status, text, model, cfg);
    }
    return parseCompletion(text, model, cfg);
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderError(`Timeout ${Math.round(timeoutMs / 1000)} detik menunggu ${model}`, {
        code: "TIMEOUT",
        retryable: true,
      });
    }
    throw new AiProviderError("Gagal menghubungi InferHub", {
      code: "NETWORK",
      retryable: true,
      detail: redact(error instanceof Error ? error.message : String(error), cfg.apiKey),
    });
  } finally {
    clearTimeout(timer);
  }
};

const runWithRetry = async (
  cfg: InferhubConfig,
  model: string,
  input: ChatInput,
): Promise<ChatOutput> => {
  let useResponseFormat = input.jsonMode === true;
  let responseFormatFallbackUsed = false;
  let lastError: AiProviderError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await postChat(cfg, model, input, useResponseFormat);
    } catch (error) {
      const failure =
        error instanceof AiProviderError
          ? error
          : new AiProviderError("Gagal memanggil InferHub", { code: "UNKNOWN", retryable: false });
      lastError = failure;

      // response_format tidak didukung semua provider: coba sekali tanpa flag itu.
      if (
        useResponseFormat &&
        !responseFormatFallbackUsed &&
        failure.status !== undefined &&
        failure.status >= 400 &&
        failure.status < 500 &&
        failure.code !== "AUTH" &&
        failure.code !== "RATE_LIMIT" &&
        failure.code !== "MODEL_UNAVAILABLE"
      ) {
        responseFormatFallbackUsed = true;
        useResponseFormat = false;
        continue;
      }

      if (!failure.retryable || attempt === MAX_ATTEMPTS - 1) break;
      await delay(RETRY_DELAY_MS[Math.min(attempt, RETRY_DELAY_MS.length - 1)]);
    }
  }

  throw lastError ?? new AiProviderError("Gagal memanggil InferHub", { code: "UNKNOWN", retryable: false });
};

const inferhubProvider: AiProvider = {
  name: "inferhub",

  async chat(input: ChatInput): Promise<ChatOutput> {
    const cfg = getConfig();
    if (!cfg.apiKey) {
      throw new AiProviderError("INFERHUB_API_KEY belum diisi", {
        code: "AUTH",
        retryable: false,
      });
    }

    const model = input.model?.trim() || cfg.model;
    const requestHash = hashRequest(
      JSON.stringify({ model, messages: input.messages, context: input.context }),
    );
    const startedAt = Date.now();
    const log = (status: "success" | "error", output?: ChatOutput, failure?: AiProviderError) => {
      runLogger({
        operation: input.operation ?? "chat",
        provider: this.name,
        model,
        status,
        inputTokens: output?.usage?.promptTokens,
        outputTokens: output?.usage?.completionTokens,
        latencyMs: Date.now() - startedAt,
        errorCode: failure?.code,
        requestHash,
      });
    };

    try {
      let output: ChatOutput;
      try {
        output = await runWithRetry(cfg, model, input);
      } catch (error) {
        const failure =
          error instanceof AiProviderError
            ? error
            : new AiProviderError("Gagal memanggil InferHub", {
                code: "UNKNOWN",
                retryable: false,
              });
        // Model utama tidak tersedia: gunakan fallback bila dikonfigurasi.
        if (
          failure.code === "MODEL_UNAVAILABLE" &&
          cfg.fallbackModel &&
          cfg.fallbackModel !== model
        ) {
          output = await runWithRetry(cfg, cfg.fallbackModel, input);
        } else {
          throw failure;
        }
      }
      log("success", output);
      return output;
    } catch (error) {
      const failure =
        error instanceof AiProviderError
          ? error
          : new AiProviderError("Gagal memanggil InferHub", {
              code: "UNKNOWN",
              retryable: false,
            });
      log("error", undefined, failure);
      throw failure;
    }
  },

  async listModels(): Promise<string[]> {
    const cfg = getConfig();
    const response = await fetch(`${cfg.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      throw errorFromStatus(response.status, text, cfg.model, cfg);
    }
    try {
      const payload = JSON.parse(text) as { data?: Array<{ id?: string }> };
      return (payload.data ?? []).map((item) => item.id ?? "").filter(Boolean);
    } catch {
      throw new AiProviderError("Daftar model InferHub bukan JSON yang valid", {
        code: "INVALID_JSON",
        retryable: false,
        detail: redact(text, cfg.apiKey),
      });
    }
  },
};

export { inferhubProvider };
