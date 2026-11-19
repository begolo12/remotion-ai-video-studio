"use client";

import { useState } from "react";
import type { PlanV2, V2Scene } from "@/lib/plan/v2";
import { cn } from "./cn";

const inputClass =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/20";

const smallButton =
  "rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  plan: PlanV2;
  onChange: (plan: PlanV2) => void;
  onSave: () => void;
  onRegenerate: (sceneId: string, instruction: string) => void;
  onReview: () => void;
  saving: boolean;
  revision: number;
  busySceneId: string | null;
  notice: string | null;
  error: string | null;
};

const move = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((value, index) =>
    value && typeof value === "object" && "order" in value
      ? ({ ...value, order: index + 1 } as T)
      : value,
  );
};

export function StoryboardEditor({
  plan,
  onChange,
  onSave,
  onRegenerate,
  onReview,
  saving,
  revision,
  busySceneId,
  notice,
  error,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(plan.scenes[0]?.id ?? null);
  const [instructions, setInstructions] = useState<Record<string, string>>({});

  const updateScene = (id: string, patch: Partial<V2Scene>) => {
    onChange({
      ...plan,
      updatedAt: new Date().toISOString(),
      scenes: plan.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)),
    });
  };

  const reorder = (index: number, direction: -1 | 1) => {
    onChange({
      ...plan,
      updatedAt: new Date().toISOString(),
      scenes: move(plan.scenes, index, index + direction),
    });
  };

  const duplicate = (index: number) => {
    const source = plan.scenes[index];
    const copy: V2Scene = {
      ...source,
      id: crypto.randomUUID(),
      heading: `${source.heading} (salinan)`,
    };
    const scenes = [...plan.scenes];
    scenes.splice(index + 1, 0, copy);
    onChange({
      ...plan,
      scenes: scenes.map((scene, i) => ({ ...scene, order: i + 1 })),
      updatedAt: new Date().toISOString(),
    });
  };

  const remove = (id: string) => {
    if (plan.scenes.length <= 1) return;
    onChange({
      ...plan,
      scenes: plan.scenes.filter((scene) => scene.id !== id).map((scene, i) => ({ ...scene, order: i + 1 })),
      updatedAt: new Date().toISOString(),
    });
  };

  const issueCount = plan.quality.filter((item) => item.severity === "error").length;

  return (
    <section
      aria-labelledby="storyboard-heading"
      className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl shadow-black/20 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
            Langkah 3
          </p>
          <h2 id="storyboard-heading" className="mt-1 text-lg font-semibold text-white">
            Edit storyboard
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Revisi {revision}. Perubahan Anda menjadi revisi baru. Preview dan render memakai revisi terakhir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={smallButton} onClick={onReview} disabled={saving}>
            Periksa kualitas
          </button>
          <button
            type="button"
            className="rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan revisi"}
          </button>
        </div>
      </div>

      {issueCount > 0 ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {issueCount} catatan kualitas perlu diperiksa sebelum render.
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      <ol className="mt-5 space-y-2">
        {plan.scenes.map((scene, index) => {
          const open = expanded === scene.id;
          const busy = busySceneId === scene.id;
          return (
            <li key={scene.id} className="rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setExpanded(open ? null : scene.id)}
                  aria-expanded={open}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/10 font-mono text-[10px] text-zinc-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-zinc-100">
                      {scene.heading || scene.purpose || "Scene tanpa judul"}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-zinc-500">
                      {scene.visual} · {scene.durationSeconds} dtk · {scene.type}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className={smallButton} onClick={() => reorder(index, -1)} disabled={index === 0} aria-label="Pindah ke atas">↑</button>
                  <button type="button" className={smallButton} onClick={() => reorder(index, 1)} disabled={index === plan.scenes.length - 1} aria-label="Pindah ke bawah">↓</button>
                  <button type="button" className={smallButton} onClick={() => duplicate(index)} aria-label="Duplikat scene">Duplikat</button>
                  <button type="button" className={smallButton} onClick={() => remove(scene.id)} disabled={plan.scenes.length <= 1} aria-label="Hapus scene">Hapus</button>
                </div>
              </div>

              {open ? (
                <div className="space-y-3 border-t border-white/[0.07] px-3 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-zinc-400">Judul scene</span>
                      <input className={inputClass} value={scene.heading} onChange={(e) => updateScene(scene.id, { heading: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-zinc-400">Durasi (detik)</span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        className={inputClass}
                        value={scene.durationSeconds}
                        onChange={(e) => updateScene(scene.id, { durationSeconds: Math.max(2, Math.min(30, Number(e.target.value) || 2)) })}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-400">Narasi</span>
                    <textarea
                      className={cn(inputClass, "min-h-20 resize-y")}
                      value={scene.narration}
                      onChange={(e) => updateScene(scene.id, { narration: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-400">Caption</span>
                    <input className={inputClass} value={scene.caption} onChange={(e) => updateScene(scene.id, { caption: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-400">Arahan visual</span>
                    <textarea
                      className={cn(inputClass, "min-h-16 resize-y")}
                      value={scene.visualDirection}
                      onChange={(e) => updateScene(scene.id, { visualDirection: e.target.value })}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-zinc-400">Visual</span>
                      <select
                        className={inputClass}
                        value={scene.visual}
                        onChange={(e) => updateScene(scene.id, { visual: e.target.value as V2Scene["visual"] })}
                      >
                        {["vehicle", "container", "factory", "ship", "globe", "pipeline", "chart", "phone", "person", "house", "mountain", "lab", "money", "food", "network", "finale"].map((kind) => (
                          <option key={kind} value={kind}>{kind}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-zinc-400">Kamera</span>
                      <select
                        className={inputClass}
                        value={scene.camera}
                        onChange={(e) => updateScene(scene.id, { camera: e.target.value as V2Scene["camera"] })}
                      >
                        {["push-in", "pull-out", "pan-left", "pan-right", "static"].map((camera) => (
                          <option key={camera} value={camera}>{camera}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/80">
                      Regenerasi scene dengan AI
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        className={inputClass}
                        placeholder="Misal: buat lebih singkat dan lebih mengejutkan"
                        value={instructions[scene.id] ?? ""}
                        onChange={(e) => setInstructions((prev) => ({ ...prev, [scene.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40"
                        disabled={busy || (instructions[scene.id] ?? "").trim().length < 3}
                        onClick={() => onRegenerate(scene.id, (instructions[scene.id] ?? "").trim())}
                      >
                        {busy ? "Memproses..." : "Regenerasi"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
