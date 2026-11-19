"use client";

import { useState } from "react";
import type { VideoPlan } from "@/lib/plan/schema";
import { getStyleTokens } from "@/lib/plan/styles";
import { TEMPLATE_LABELS, computeSceneTimings, effectiveSeconds } from "@/lib/plan/timing";
import { cn } from "./cn";
import {
  formatClock,
  formatDuration,
  formatSceneSeconds,
  sceneTexts,
} from "./format";
import { CheckIcon, CopyIcon, CpuIcon } from "./icons";

type PlanPanelProps = {
  plan: VideoPlan;
  isSample: boolean;
  model: string | null;
  fellBack: boolean;
};

type CopyState = "idle" | "ok" | "fail";

const metaChip =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300";

export function PlanPanel({ plan, isSample, model, fellBack }: PlanPanelProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const style = getStyleTokens(plan.styleId);
  const hashtags = plan.hashtags ?? [];
  const timings = computeSceneTimings(plan);
  const sceneTimings = timings.slice(0, plan.scenes.length);
  const outroTiming = timings[timings.length - 1];
  const totalFrames = timings.reduce(
    (sum, timing) => sum + timing.durationInFrames,
    0,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plan.caption);
      setCopyState("ok");
    } catch {
      setCopyState("fail");
    }
    window.setTimeout(() => setCopyState("idle"), 2400);
  };

  return (
    <section
      aria-labelledby="plan-heading"
      className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
              Rencana video
            </p>
            {isSample ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Contoh
              </span>
            ) : null}
          </div>
          <h2
            id="plan-heading"
            data-testid="plan-title"
            className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl"
          >
            {plan.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-300">
            <span className="text-zinc-400">Hook: </span>
            {plan.hook}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="plan-scene-count" className={metaChip}>
            {plan.scenes.length} scene
          </span>
          <span className={metaChip} title="Durasi akhir mengikuti panjang narasi suara">
            {formatDuration(effectiveSeconds(plan))}
          </span>
          <span className={metaChip}>{style.label}</span>
          <span
            data-testid="model-badge"
            className={cn(
              metaChip,
              "max-w-[260px] font-mono",
              isSample ? "text-zinc-400" : "text-zinc-200",
            )}
            title={model ? `Model: ${model}` : "Rencana contoh"}
          >
            <CpuIcon className="size-3 shrink-0 text-zinc-500" />
            <span className="min-w-0 truncate">{model ?? "Contoh"}</span>
          </span>
          {fellBack ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-300">
              fallback
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Struktur scene
          </h3>
          <ol className="mt-3 space-y-2">
            {plan.scenes.map((scene, index) => {
              const timing = sceneTimings[index];
              const { primary, secondary } = sceneTexts(scene);
              const share =
                totalFrames > 0
                  ? (timing.durationInFrames / totalFrames) * 100
                  : 0;

              return (
                <li
                  key={`${index}-${scene.template}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-[11px] tabular-nums text-amber-400/80">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
                          {TEMPLATE_LABELS[scene.template]}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {formatSceneSeconds(timing.durationInFrames)}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-600">
                          {formatClock(timing.from)} –{" "}
                          {formatClock(timing.from + timing.durationInFrames)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-100">
                        {primary}
                      </p>
                      {secondary ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                          {secondary}
                        </p>
                      ) : null}
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${Math.max(4, share)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}

            <li className="rounded-xl border border-dashed border-amber-400/25 bg-amber-400/[0.04] p-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-[11px] tabular-nums text-amber-400/80">
                  {String(plan.scenes.length + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                      {TEMPLATE_LABELS.outro}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {formatSceneSeconds(outroTiming.durationInFrames)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-100">
                    {plan.outro.heading}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {plan.outro.cta}
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Caption YouTube
              </h3>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {copyState === "ok" ? (
                  <CheckIcon className="size-3.5 text-emerald-300" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
                Salin caption
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
              {plan.caption}
            </p>
            <p
              aria-live="polite"
              className={cn(
                "mt-2 min-h-4 text-[11px]",
                copyState === "fail" ? "text-red-300" : "text-emerald-300",
              )}
            >
              {copyState === "ok"
                ? "Caption tersalin ke clipboard."
                : copyState === "fail"
                  ? "Gagal menyalin. Salin caption secara manual."
                  : ""}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Hashtag
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hashtags.length > 0 ? (
                hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-1 font-mono text-[11px] text-amber-200"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-400">
                  Tidak ada hashtag pada rencana ini.
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <dt className="text-zinc-400">Durasi akhir</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">
                {effectiveSeconds(plan).toLocaleString("id-ID")} detik
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <dt className="text-zinc-400">Total frame</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">
                {totalFrames.toLocaleString("id-ID")} @30fps
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <dt className="text-zinc-400">Target permintaan</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">
                {plan.targetSeconds} detik
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <dt className="text-zinc-400">Scene bersuara</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">
                {plan.scenes.filter((scene) => scene.audio).length}/{plan.scenes.length}
              </dd>
            </div>
            {plan.musicMood ? (
              <div className="col-span-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                <dt className="text-zinc-400">Mood musik</dt>
                <dd className="mt-0.5 text-zinc-200">{plan.musicMood}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}
