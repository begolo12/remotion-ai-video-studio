"use client";

import type { ReactNode } from "react";
import type { ApiError } from "./api";
import { cn } from "./cn";
import { AlertIcon, CheckIcon, XIcon } from "./icons";

type ErrorBannerProps = {
  error: ApiError;
  onClose: () => void;
};

export function ErrorBanner({ error, onClose }: ErrorBannerProps) {
  return (
    <div
      data-testid="error-banner"
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.09] px-4 py-3"
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-300" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-200">{error.message}</p>
        {error.issues.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-[11px] text-red-200/80">
            {error.issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        ) : null}
        {error.detail ? (
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-red-200/70">
            {error.detail}
          </pre>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup pesan error"
        className="-mr-1 rounded-lg p-1.5 text-red-300/80 transition hover:bg-red-500/15 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

type StatusBannerProps = {
  tone: "busy" | "success";
  children: ReactNode;
};

export function StatusBanner({ tone, children }: StatusBannerProps) {
  return (
    <div
      data-testid="status-banner"
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "busy"
          ? "border-amber-400/25 bg-amber-400/[0.08] text-amber-100"
          : "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100",
      )}
    >
      {tone === "busy" ? (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300"
        >
          <CheckIcon className="size-3" />
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
