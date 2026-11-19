"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Project, ProjectSummary, StyleId } from "@/lib/plan/schema";
import type { PlanV2 } from "@/lib/plan/v2";
import { getStyleTokens } from "@/lib/plan/styles";
import { totalFramesFor } from "@/lib/plan/timing";
import { SAMPLE_PLAN } from "@/video/sample-plan";
import {
  ApiError,
  fetchHealth,
  fetchProjects,
  fetchRenderJob,
  fetchStudioProject,
  generateVideo,
  regenerateScene,
  removeProject,
  reviewStoryboard,
  saveStoryboard,
  startRender,
  type HealthResponse,
  type RenderJob,
} from "./api";
import { ErrorBanner, StatusBanner } from "./banners";
import { cn } from "./cn";
import { errorMessage, formatCount, formatDuration, slugify } from "./format";
import { HistoryPanel } from "./history-panel";
import { FilmIcon, SparkleIcon } from "./icons";
import { PlanPanel } from "./plan-panel";
import { PlayerPreview } from "./player-preview";
import { RenderPanel, type RenderState } from "./render-panel";
import { StylePicker } from "./style-picker";
import { StoryboardEditor } from "./storyboard-editor";

const DURATION_OPTIONS = [
  { seconds: 30, label: "0,5 menit" },
  { seconds: 60, label: "1 menit" },
  { seconds: 90, label: "1,5 menit" },
  { seconds: 120, label: "2 menit" },
  { seconds: 150, label: "2,5 menit" },
  { seconds: 180, label: "3 menit" },
] as const;

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;
const POLL_INTERVAL_MS = 1500;

/** Model InferHub yang dipakai studio. */
const MODEL_SUGGESTIONS = ["cx/gpt-6.2-sol"];

const IDLE_RENDER: RenderState = { status: "idle", progress: 0, logs: [] };

const previewChip =
  "inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-300";

type HealthState =
  | { status: "loading"; data: null }
  | { status: "online"; data: HealthResponse }
  | { status: "offline"; data: HealthResponse | null };

const toApiError = (error: unknown): ApiError =>
  error instanceof ApiError ? error : new ApiError(errorMessage(error));

const jobToRenderState = (job: RenderJob): RenderState => ({
  status: job.status,
  progress: job.progress,
  url: job.url,
  file: job.file,
  message: job.message,
  logs: job.logs,
});

export function StudioApp() {
  const [description, setDescription] = useState("");
  const [targetSeconds, setTargetSeconds] = useState<number>(60);
  const [styleId, setStyleId] = useState<StyleId>("cinematic");
  const [modelOverride, setModelOverride] = useState("");
  const [voice, setVoice] = useState<"male" | "female" | "off">("male");

  const [project, setProject] = useState<Project | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const [health, setHealth] = useState<HealthState>({
    status: "loading",
    data: null,
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const [render, setRender] = useState<RenderState>(IDLE_RENDER);
  const [planV2, setPlanV2] = useState<PlanV2 | null>(null);
  const [revision, setRevision] = useState(1);
  const [storyboardSaving, setStoryboardSaving] = useState(false);
  const [busySceneId, setBusySceneId] = useState<string | null>(null);
  const [storyboardNotice, setStoryboardNotice] = useState<string | null>(null);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);

  const pollTimer = useRef<number | null>(null);
  const pollToken = useRef(0);
  const alive = useRef(true);

  const stopPolling = useCallback(() => {
    pollToken.current += 1;
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [healthResult, projectsResult] = await Promise.allSettled([
        fetchHealth(),
        fetchProjects(),
      ]);
      if (cancelled) return;

      if (healthResult.status === "fulfilled") {
        const data = healthResult.value;
        setHealth(
          data.ok
            ? { status: "online", data }
            : { status: "offline", data },
        );
      } else {
        setHealth({ status: "offline", data: null });
      }

      if (projectsResult.status === "fulfilled") {
        setProjects(projectsResult.value);
        setProjectsError(null);
      } else {
        setProjectsError(errorMessage(projectsResult.reason));
      }
      setProjectsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshHealth = useCallback(async () => {
    setHealth({ status: "loading", data: null });
    try {
      const data = await fetchHealth();
      setHealth(data.ok ? { status: "online", data } : { status: "offline", data });
    } catch {
      setHealth({ status: "offline", data: null });
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const list = await fetchProjects();
      setProjects(list);
      setProjectsError(null);
    } catch (err) {
      setProjectsError(errorMessage(err));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      const token = pollToken.current;
      const isCurrent = () => alive.current && token === pollToken.current;

      const tick = async () => {
        try {
          const job = await fetchRenderJob(jobId);
          if (!isCurrent()) return;
          setRender(jobToRenderState(job));
          if (job.status === "done" || job.status === "error") return;
        } catch (err) {
          if (!isCurrent()) return;
          setRender({
            status: "error",
            progress: 0,
            logs: [],
            message: errorMessage(err),
          });
          return;
        }

        if (!isCurrent()) return;
        pollTimer.current = window.setTimeout(() => {
          void tick();
        }, POLL_INTERVAL_MS);
      };

      void tick();
    },
    [],
  );

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = description.trim();
    if (trimmed.length < MIN_DESCRIPTION) {
      setError(
        new ApiError(`Deskripsi minimal ${MIN_DESCRIPTION} karakter.`),
      );
      return;
    }

    stopPolling();
    setRender(IDLE_RENDER);
    setIsGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const result = await generateVideo({
        description: trimmed,
        targetSeconds,
        styleId,
        model: modelOverride.trim() || undefined,
        voice: voice === "off" ? undefined : voice,
        withNarration: voice !== "off",
      });
      setProject(result.project);
      setPlanV2(result.planV2 ?? null);
      setRevision(1);
      setActiveProjectId(result.project.id);
      setNotice(
        result.fellBack
          ? `Skenario siap. Model ${result.model} dipakai sebagai cadangan.`
          : `Skenario siap dibuat dengan ${result.model}.`,
      );
      await refreshProjects();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRender = async () => {
    if (!project) return;
    stopPolling();
    setRender({ status: "starting", progress: 0, logs: [] });
    try {
      const job = await startRender(project.id);
      setRender(jobToRenderState(job));
      if (job.status !== "done" && job.status !== "error") {
        pollJob(job.id);
      }
    } catch (err) {
      setRender({
        status: "error",
        progress: 0,
        logs: [],
        message: errorMessage(err),
      });
    }
  };

  const handleSelectProject = async (id: string) => {
    if (pendingProjectId) return;
    setPendingProjectId(id);
    setError(null);
    setNotice(null);
    stopPolling();
    setRender(IDLE_RENDER);
    try {
      const loaded = await fetchStudioProject(id);
      setProject(loaded.project);
      setPlanV2(loaded.planV2);
      setRevision(loaded.revision);
      setActiveProjectId(loaded.project.id);
      setDescription(loaded.project.input.description);
      setTargetSeconds(loaded.project.input.targetSeconds);
      setStyleId(loaded.project.input.styleId);
      setModelOverride(loaded.project.input.model ?? "");
      setVoice(
        loaded.project.narration?.enabled
          ? loaded.project.narration.voice.includes("Gadis")
            ? "female"
            : "male"
          : "off",
      );
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setPendingProjectId(null);
    }
  };

  const handleSaveStoryboard = async () => {
    if (!planV2 || !activeProjectId) return;
    setStoryboardSaving(true);
    setStoryboardError(null);
    setStoryboardNotice(null);
    try {
      const result = await saveStoryboard(activeProjectId, planV2);
      setPlanV2(result.planV2);
      setRevision(result.revision);
      setStoryboardNotice(`Revisi ${result.revision} tersimpan.`);
    } catch (err) {
      setStoryboardError(errorMessage(err));
    } finally {
      setStoryboardSaving(false);
    }
  };

  const handleRegenerateScene = async (sceneId: string, instruction: string) => {
    if (!activeProjectId) return;
    setBusySceneId(sceneId);
    setStoryboardError(null);
    setStoryboardNotice(null);
    try {
      const result = await regenerateScene(activeProjectId, sceneId, instruction);
      setPlanV2(result.planV2);
      setRevision(result.revision);
      setStoryboardNotice(`Scene diperbarui pada revisi ${result.revision}.`);
    } catch (err) {
      setStoryboardError(errorMessage(err));
    } finally {
      setBusySceneId(null);
    }
  };

  const handleReview = async () => {
    if (!activeProjectId || !planV2) return;
    setStoryboardSaving(true);
    setStoryboardError(null);
    setStoryboardNotice(null);
    try {
      const result = await reviewStoryboard(activeProjectId);
      const issues = result.issues as PlanV2["quality"];
      setPlanV2({ ...planV2, quality: issues });
      setRevision(result.revision);
      setStoryboardNotice(
        issues.length === 0
          ? "Tidak ada catatan kualitas."
          : `${issues.length} catatan kualitas tersimpan di revisi ${result.revision}.`,
      );
    } catch (err) {
      setStoryboardError(errorMessage(err));
    } finally {
      setStoryboardSaving(false);
    }
  };

  const handleDeleteProject = async (summary: ProjectSummary) => {
    const confirmed = window.confirm(
      `Hapus project “${summary.planTitle}”? File project akan dihapus permanen.`,
    );
    if (!confirmed) return;

    setDeletingProjectId(summary.id);
    try {
      await removeProject(summary.id);
      if (project?.id === summary.id) {
        setProject(null);
        setActiveProjectId(null);
        setNotice(null);
        stopPolling();
        setRender(IDLE_RENDER);
      }
      await refreshProjects();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleReset = () => {
    stopPolling();
    setProject(null);
    setPlanV2(null);
    setActiveProjectId(null);
    setDescription("");
    setNotice(null);
    setStoryboardNotice(null);
    setStoryboardError(null);
    setError(null);
    setRender(IDLE_RENDER);
    setModelOverride("");
    setVoice("male");
  };

  const plan = project?.plan ?? SAMPLE_PLAN;
  const isSample = project === null;
  const model = project?.model ?? null;
  const fellBack = project?.fellBack ?? false;
  const styleLabel = getStyleTokens(plan.styleId).label;
  const frames = totalFramesFor(plan);
  const healthData = health.data;
  const healthLabel =
    health.status === "online"
      ? "InferHub siap"
      : health.status === "offline"
        ? "InferHub tidak terhubung"
        : "Memeriksa InferHub…";
  const healthDot =
    health.status === "online"
      ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.16)]"
      : health.status === "offline"
        ? "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.16)]"
        : "bg-zinc-500 studio-pulse";
  const healthText =
    health.status === "online"
      ? "text-emerald-300"
      : health.status === "offline"
        ? "text-red-300"
        : "text-zinc-400";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-zinc-950 shadow-lg shadow-amber-500/20">
              <FilmIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
                Remotion Short Studio
              </h1>
              <p className="hidden truncate text-[11px] text-zinc-400 sm:block">
                Dari ide ke YouTube Short 9:16 — skenario, pratinjau, render MP4.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshHealth()}
            aria-label={`Status InferHub: ${healthLabel}. Klik untuk memeriksa ulang.`}
            title={healthData?.baseUrl ?? "Periksa status InferHub"}
            className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left transition hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", healthDot)}
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className={cn("text-[11px] font-medium", healthText)}>
                {healthLabel}
              </span>
              {healthData?.model ? (
                <span className="max-w-[150px] truncate font-mono text-[10px] text-zinc-400 sm:max-w-[220px]">
                  {healthData.model}
                </span>
              ) : null}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <section
            aria-labelledby="form-heading"
            className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 shadow-xl shadow-black/25 backdrop-blur sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
                  Langkah 1
                </p>
                <h2
                  id="form-heading"
                  className="mt-1 text-lg font-semibold tracking-tight text-white"
                >
                  Buat video baru
                </h2>
              </div>
              {project ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  Project baru
                </button>
              ) : null}
            </div>

            <form onSubmit={handleGenerate} className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="description"
                    className="text-sm font-medium text-zinc-200"
                  >
                    Deskripsi video
                  </label>
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      description.length >= MAX_DESCRIPTION
                        ? "text-amber-300"
                        : "text-zinc-400",
                    )}
                  >
                    {description.length}/{MAX_DESCRIPTION}
                  </span>
                </div>
                <textarea
                  id="description"
                  data-testid="input-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={MAX_DESCRIPTION}
                  rows={5}
                  disabled={isGenerating}
                  aria-describedby="description-hint"
                  placeholder="Contoh: 3 kebiasaan pagi yang bikin fokus seharian, untuk mahasiswa yang sering begadang dan susah konsentrasi."
                  className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 transition focus:border-amber-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p
                  id="description-hint"
                  className="mt-1.5 text-[11px] leading-relaxed text-zinc-400"
                >
                  Minimal {MIN_DESCRIPTION} karakter. Sebutkan topik, audiens, dan
                  sudut pandangnya agar skenario lebih tajam.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="duration"
                    className="text-sm font-medium text-zinc-200"
                  >
                    Durasi video
                  </label>
                  <select
                    id="duration"
                    data-testid="input-duration"
                    value={targetSeconds}
                    onChange={(event) =>
                      setTargetSeconds(Number(event.target.value))
                    }
                    disabled={isGenerating}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 transition focus:border-amber-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.seconds} value={option.seconds}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Setara {targetSeconds} detik.
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-zinc-200">
                    Spesifikasi
                  </span>
                  <div className="mt-2 flex h-[42px] items-center rounded-xl border border-white/10 bg-zinc-950/50 px-3 font-mono text-[11px] text-zinc-400">
                    9:16 · 1080p · 30 fps
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="model"
                    className="text-sm font-medium text-zinc-200"
                  >
                    Model AI (opsional)
                  </label>
                  <input
                    id="model"
                    data-testid="input-model"
                    list="model-options"
                    value={modelOverride}
                    onChange={(event) => setModelOverride(event.target.value)}
                    disabled={isGenerating}
                    placeholder={healthData?.model || "d/standar"}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 transition focus:border-amber-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <datalist id="model-options">
                    {MODEL_SUGGESTIONS.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Kosongkan untuk memakai model default 9Router.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="voice"
                    className="text-sm font-medium text-zinc-200"
                  >
                    Suara narasi
                  </label>
                  <select
                    id="voice"
                    data-testid="input-voice"
                    value={voice}
                    onChange={(event) =>
                      setVoice(event.target.value as "male" | "female" | "off")
                    }
                    disabled={isGenerating}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 transition focus:border-amber-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="male">Pria (Ardi)</option>
                    <option value="female">Wanita (Gadis)</option>
                    <option value="off">Tanpa suara</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Narasi bahasa Indonesia; durasi video mengikuti panjang suara.
                  </p>
                </div>
              </div>

              <StylePicker
                value={styleId}
                onChange={setStyleId}
                disabled={isGenerating}
              />

              <div className="space-y-2.5">
                <button
                  type="submit"
                  data-testid="btn-generate"
                  disabled={
                    isGenerating ||
                    description.trim().length < MIN_DESCRIPTION
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {isGenerating ? (
                    <span
                      aria-hidden="true"
                      className="size-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950"
                    />
                  ) : (
                    <SparkleIcon className="size-4" />
                  )}
                  {isGenerating ? "AI sedang menulis…" : "Buat video dengan AI"}
                </button>
                <p className="text-center text-[11px] text-zinc-400">
                  Skenario ditulis lewat 9Router, lalu dirender dengan Remotion.
                </p>

                {error ? (
                  <ErrorBanner error={error} onClose={() => setError(null)} />
                ) : null}

                {isGenerating || notice ? (
                  <StatusBanner tone={isGenerating ? "busy" : "success"}>
                    {isGenerating ? "AI sedang menulis skenario…" : notice}
                  </StatusBanner>
                ) : null}
              </div>
            </form>
          </section>

          <div className="space-y-3 lg:sticky lg:top-24">
            <section
              aria-labelledby="preview-heading"
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-xl shadow-black/25 backdrop-blur sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
                    Pratinjau
                  </p>
                  <h2
                    id="preview-heading"
                    className="mt-1 text-lg font-semibold tracking-tight text-white"
                  >
                    Hasil skenario
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {isSample ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                      Contoh
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                      Project aktif
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-start">
                <div className="min-w-0">
                  <PlayerPreview plan={plan} isSample={isSample} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-zinc-400">
                    <span>1080 × 1920 · 30 fps</span>
                    <span>{formatCount(frames)} frame</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      Rencana aktif
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-zinc-100">
                      {plan.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                      {plan.hook}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className={previewChip}>
                        {plan.scenes.length} scene
                      </span>
                      <span className={previewChip}>
                        {formatDuration(plan.targetSeconds)}
                      </span>
                      <span className={previewChip}>{styleLabel}</span>
                      {model ? (
                        <span
                          className={cn(
                            previewChip,
                            "max-w-[190px] font-mono text-zinc-400",
                          )}
                          title={model}
                        >
                          <span className="min-w-0 truncate">{model}</span>
                        </span>
                      ) : null}
                      {fellBack ? (
                        <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          fallback
                        </span>
                      ) : null}
                      {project?.narration?.enabled ? (
                        <span
                          data-testid="narration-badge"
                          className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-300"
                          title={`${project.narration.scenes} scene bersuara · ${project.narration.totalSeconds.toFixed(1)} dtk`}
                        >
                          suara aktif
                        </span>
                      ) : project ? (
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                          tanpa suara
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <RenderPanel
                    state={render}
                    canRender={!isSample}
                    fileName={`${slugify(plan.title)}.mp4`}
                    onRender={() => void handleRender()}
                  />
                </div>
              </div>
            </section>

            {isSample ? (
              <p className="px-1 text-[11px] leading-relaxed text-zinc-400">
                Pratinjau memakai rencana contoh. Buat video baru untuk melihat
                hasil dari idemu, lalu render MP4-nya.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 lg:mt-6">
          <PlanPanel
            plan={plan}
            isSample={isSample}
            model={model}
            fellBack={fellBack}
          />
        </div>

        {planV2 && !isSample ? (
          <div className="mt-5 lg:mt-6">
            <StoryboardEditor
              plan={planV2}
              onChange={setPlanV2}
              onSave={() => void handleSaveStoryboard()}
              onRegenerate={(sceneId, instruction) =>
                void handleRegenerateScene(sceneId, instruction)
              }
              onReview={() => void handleReview()}
              saving={storyboardSaving}
              revision={revision}
              busySceneId={busySceneId}
              notice={storyboardNotice}
              error={storyboardError}
            />
          </div>
        ) : null}

        <div className="mt-5 lg:mt-6">
          <HistoryPanel
            projects={projects}
            loading={projectsLoading}
            error={projectsError}
            activeProjectId={activeProjectId}
            pendingProjectId={pendingProjectId}
            deletingProjectId={deletingProjectId}
            onSelect={(id) => void handleSelectProject(id)}
            onDelete={(summary) => void handleDeleteProject(summary)}
            onRefresh={() => void refreshProjects()}
          />
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-5 text-center text-[11px] text-zinc-500">
        Next.js + Remotion · InferHub · Neon · render 1080×1920
      </footer>
    </div>
  );
}
