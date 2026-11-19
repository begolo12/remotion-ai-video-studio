import { FPS, type Scene, type VideoPlan } from "./schema";

export type TimedScene = {
  scene: Scene;
  from: number;
  durationInFrames: number;
  index: number;
};

/** Jeda setelah kalimat selesai supaya tidak terasa dipotong. */
const AUDIO_TAIL_SECONDS = 0.35;
/** Durasi scene tanpa audio (mis. narasi gagal disintesis). */
const SILENT_SCENE_SECONDS = 2.8;
/** Panjang minimum scene penutup. */
const OUTRO_MIN_SECONDS = 2.6;

export const hasNarration = (plan: VideoPlan): boolean =>
  plan.scenes.some((scene) => (scene.audio?.seconds ?? 0) > 0.2);

/** Durasi scene penutup dalam frame. */
const outroFrames = (plan: VideoPlan, spokenFrames: number): number =>
  Math.max(
    Math.round(OUTRO_MIN_SECONDS * FPS),
    hasNarration(plan)
      ? Math.round(spokenFrames * 0.08)
      : Math.round(plan.targetSeconds * FPS * 0.12),
  );

/** Durasi tiap scene isi dalam frame (jumlah persis = target - outro). */
const sceneFrames = (plan: VideoPlan): number[] => {
  if (!hasNarration(plan)) {
    const weights = plan.scenes.map((scene) => Math.min(3, Math.max(0.4, scene.weight ?? 1)));
    const sum = weights.reduce((a, b) => a + b, 0);
    // Tanpa audio, target user adalah durasi TOTAL: sisa setelah outro.
    const total = Math.round(plan.targetSeconds * FPS);
    const spoken = Math.max(1, total - outroFrames(plan, 0));

    const exact = weights.map((weight) => (weight / sum) * spoken);
    const frames = exact.map((value) => Math.floor(value));
    let remainder = spoken - frames.reduce((a, b) => a + b, 0);
    const order = exact
      .map((value, index) => ({ index, frac: value - Math.floor(value) }))
      .sort((a, b) => b.frac - a.frac);
    for (let i = 0; remainder > 0; i += 1, remainder -= 1) {
      frames[order[i % order.length].index] += 1;
    }
    return frames.map((value) => Math.max(1, value));
  }

  return plan.scenes.map((scene) =>
    scene.audio
      ? Math.max(1, Math.round((scene.audio.seconds + AUDIO_TAIL_SECONDS) * FPS))
      : Math.round(SILENT_SCENE_SECONDS * FPS),
  );
};

/** Total durasi komposisi dalam frame. */
export const totalFramesFor = (plan: VideoPlan): number => {
  const frames = sceneFrames(plan);
  const spoken = frames.reduce((sum, value) => sum + value, 0);
  return Math.max(FPS, spoken + outroFrames(plan, spoken));
};

export const audioSecondsFor = (plan: VideoPlan): number =>
  plan.scenes.reduce((total, scene) => total + (scene.audio?.seconds ?? 0), 0);

/** Durasi efektif video (detik) setelah narasi dihitung. */
export const effectiveSeconds = (plan: VideoPlan): number =>
  Number((totalFramesFor(plan) / FPS).toFixed(1));

export const computeSceneTimings = (plan: VideoPlan): TimedScene[] => {
  const frames = [...sceneFrames(plan)];
  const spoken = frames.reduce((sum, value) => sum + value, 0);
  frames.push(outroFrames(plan, spoken));

  let cursor = 0;
  return frames.map((duration, index) => {
    const scene: Scene =
      index < plan.scenes.length
        ? plan.scenes[index]
        : { template: "outro", heading: plan.outro.heading, text: plan.outro.cta };
    const timed: TimedScene = { scene, from: cursor, durationInFrames: duration, index };
    cursor += duration;
    return timed;
  });
};

/** Label template untuk UI. */
export const TEMPLATE_LABELS: Record<Scene["template"], string> = {
  hook: "Hook",
  bullets: "Poin",
  stat: "Angka",
  quote: "Kutipan",
  statement: "Pernyataan",
  outro: "Penutup",
};
