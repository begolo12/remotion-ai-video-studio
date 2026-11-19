"use client";

import type { ProjectSummary } from "@/lib/plan/schema";
import { getStyleTokens } from "@/lib/plan/styles";
import { cn } from "./cn";
import { formatDate } from "./format";
import { RefreshIcon, TrashIcon } from "./icons";

type HistoryPanelProps = {
  projects: ProjectSummary[];
  loading: boolean;
  error: string | null;
  activeProjectId: string | null;
  pendingProjectId: string | null;
  deletingProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete: (project: ProjectSummary) => void;
  onRefresh: () => void;
};

const chip =
  "inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-300";

export function HistoryPanel({
  projects,
  loading,
  error,
  activeProjectId,
  pendingProjectId,
  deletingProjectId,
  onSelect,
  onDelete,
  onRefresh,
}: HistoryPanelProps) {
  return (
    <section
      aria-labelledby="history-heading"
      className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
            Riwayat
          </p>
          <h2
            id="history-heading"
            className="mt-1 text-lg font-semibold tracking-tight text-white"
          >
            Project tersimpan
            <span className="ml-2 font-mono text-sm font-normal text-zinc-400">
              ({projects.length})
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-white/30 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <RefreshIcon className={cn("size-3.5", loading && "animate-spin")} />
          Muat ulang
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {loading && projects.length === 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-sm font-medium text-zinc-300">
            Belum ada project tersimpan
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Tulis ide di form, lalu klik “Buat video dengan AI”. Hasilnya akan
            muncul di sini.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isPending = project.id === pendingProjectId;
            const isDeleting = project.id === deletingProjectId;

            return (
              <article
                key={project.id}
                data-testid="project-item"
                className={cn(
                  "group relative flex flex-col rounded-xl border p-4 transition",
                  isActive
                    ? "border-amber-400/50 bg-amber-400/[0.06]"
                    : "border-white/10 bg-zinc-950/40 hover:border-white/25 hover:bg-white/[0.04]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  aria-label={`Buka project ${project.planTitle}`}
                  className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                />

                <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                  <h3 className="line-clamp-2 pr-16 text-sm font-medium leading-snug text-zinc-100">
                    {project.planTitle}
                  </h3>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    {formatDate(project.createdAt)} ·{" "}
                    {getStyleTokens(project.input.styleId).label}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={chip}>{project.sceneCount} scene</span>
                    <span className={cn(chip, "max-w-[160px] font-mono text-zinc-400")}>
                      <span className="min-w-0 truncate">{project.model}</span>
                    </span>
                    {project.fellBack ? (
                      <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        fallback
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        Aktif
                      </span>
                    ) : null}
                    {isPending ? (
                      <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">
                        Memuat…
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="btn-delete-project"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(project);
                  }}
                  disabled={isDeleting}
                  aria-label={`Hapus project ${project.planTitle}`}
                  className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/90 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <TrashIcon className="size-3" />
                  Hapus
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
