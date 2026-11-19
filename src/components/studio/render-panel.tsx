"use client";

import { cn } from "./cn";
import { DownloadIcon, FilmIcon } from "./icons";

export type RenderStatus =
  | "idle"
  | "starting"
  | "queued"
  | "rendering"
  | "done"
  | "error";

export type RenderState = {
  status: RenderStatus;
  progress: number;
  url?: string;
  file?: string;
  message?: string;
  logs: string[];
};

const BUSY_STATUSES: RenderStatus[] = ["starting", "queued", "rendering"];

type RenderPanelProps = {
  state: RenderState;
  canRender: boolean;
  fileName: string;
  onRender: () => void;
};

export function RenderPanel({
  state,
  canRender,
  fileName,
  onRender,
}: RenderPanelProps) {
  const busy = BUSY_STATUSES.includes(state.status);
  const progress = Math.max(0, Math.min(100, Math.round(state.progress)));

  return (
    <div className="mt-5 border-t border-white/[0.07] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Render MP4</h3>
          <p className="text-[11px] text-zinc-400">
            H.264 · 1080 × 1920 · 30 fps
          </p>
        </div>
        <button
          type="button"
          data-testid="btn-render"
          onClick={onRender}
          disabled={!canRender || busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
            "bg-amber-400 text-zinc-950 hover:bg-amber-300",
            "disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500",
          )}
        >
          <FilmIcon className="size-4" />
          {busy ? "Merender…" : "Render MP4"}
        </button>
      </div>

      {!canRender ? (
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          Render membutuhkan project tersimpan. Buat video dulu lewat form di
          samping.
        </p>
      ) : null}

      {busy ? (
        <div
          data-testid="render-progress"
          role="progressbar"
          aria-label="Progres render"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-3"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-amber-200">
              Merender… {progress}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {state.status === "done" ? (
        <div className="mt-4">
          {state.url ? (
            <>
              <video
                data-testid="video-result"
                src={state.url}
                controls
                playsInline
                preload="metadata"
                className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-xl border border-white/10 bg-black"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <a
                  href={state.url}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  <DownloadIcon className="size-3.5" />
                  Unduh MP4
                </a>
                <span
                  className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-zinc-400"
                  title={state.file ?? state.url}
                >
                  {state.file ?? state.url}
                </span>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400">
              Render selesai, tetapi URL file tidak tersedia. Coba render ulang.
            </p>
          )}
          <p className="mt-2 text-[11px] text-emerald-300">
            Render selesai — video siap diunduh.
          </p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] p-3">
          <p className="text-xs font-medium text-red-200">Render gagal</p>
          <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">
            {state.message ?? "Terjadi kesalahan saat merender video."}
          </p>
          {state.logs.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-red-500/20 pt-2">
              {state.logs.slice(-3).map((line, index) => (
                <li
                  key={`${index}-${line}`}
                  title={line}
                  className="truncate font-mono text-[10px] text-red-200/60"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
