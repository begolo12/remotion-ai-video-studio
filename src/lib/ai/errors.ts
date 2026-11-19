export type AiErrorCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "AUTH"
  | "MODEL_UNAVAILABLE"
  | "INVALID_JSON"
  | "EMPTY_RESPONSE"
  | "NETWORK"
  | "UNKNOWN";

type AiProviderErrorOptions = {
  code: AiErrorCode;
  status?: number;
  retryable: boolean;
  detail?: string;
};

/**
 * Satu error untuk semua kegagalan layer AI. `retryable` dipakai provider
 * untuk memutuskan backoff; `detail` sudah disanitasi (tanpa kredensial).
 */
export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly detail?: string;

  constructor(message: string, opts: AiProviderErrorOptions) {
    super(message);
    this.name = "AiProviderError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.detail = opts.detail;
  }
}
