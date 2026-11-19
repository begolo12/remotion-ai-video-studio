import React from "react";
import { AbsoluteFill, Audio, Sequence, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FPS, type Scene, type VideoPlan, type VisualKind } from "../lib/plan/schema";
import { cameraMove, enterFade, exitFade } from "./anim";
import { KaraokeCaption, SceneLabel, fallbackWords } from "./captions";
import { alpha, getDesign, type Design } from "./design";
import { OBJECT_COMPONENTS, Clouds, Ground, Ocean, Road, Sky, Stars, Vignette, Callout } from "./illustrations";
import { computeSceneTimings, totalFramesFor } from "../lib/plan/timing";

export type ShortVideoProps = {
  plan: VideoPlan;
};

/** Latar yang dipilih sesuai objek ilustrasi (bukan gradient abstrak). */
const SceneBackdrop: React.FC<{ visual: VisualKind; design: Design; progress: number }> = ({
  visual,
  design,
  progress,
}) => {
  const space = visual === "globe" || visual === "network" || visual === "finale";
  const sea = visual === "ship";
  const road = visual === "vehicle";
  const warm = visual === "factory" || visual === "lab";

  return (
    <>
      <Sky design={design} variant={space ? "space" : warm ? "warm" : sea ? "pale" : "day"} />
      {space ? <Stars design={design} /> : <Clouds design={design} opacity={0.6} />}
      {sea ? <Ocean design={design} top={1020} drift={progress * 90} /> : null}
      {road ? <Road design={design} top={1050} /> : null}
      {!sea && !road && !space ? <Ground design={design} top={1080} grass={visual !== "factory"} /> : null}
    </>
  );
};

/** Stage ilustrasi: push-in kamera mengikuti referensi. */
const SceneSlot: React.FC<{
  scene: Scene;
  design: Design;
  durationInFrames: number;
  index: number;
}> = ({ scene, design, durationInFrames, index }) => {
  const frame = useCurrentFrame();
  const visual: VisualKind = scene.visual ?? "container";
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const ObjectComponent = OBJECT_COMPONENTS[visual] ?? OBJECT_COMPONENTS.container;
  const camera = cameraMove(frame, durationInFrames, index, 1.1);
  const fade = Math.min(enterFade(frame, durationInFrames, 8), exitFade(frame, durationInFrames, 8));
  const seconds = frame / FPS;

  const labels = (scene.callouts ?? []).slice(0, 3);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        // Warna dasar eksplisit: bila SVG backdrop punya celah saat render video,
        // jangan sampai jatuh ke hitam default AbsoluteFill.
        background: `linear-gradient(180deg, ${design.bgFrom} 0%, ${design.bgTo} 100%)`,
      }}
    >
      {/* Latar tidak ikut kamera supaya tidak ada sudut hitam saat push-in. */}
      <SceneBackdrop visual={visual} design={design} progress={progress} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${camera.scale}) translate3d(${camera.x}px, ${camera.y}px, 0)`,
        }}
      >
        <div style={{ width: 720, height: 560, display: "grid", placeItems: "center" }}>
          <ObjectComponent design={design} progress={progress} label={labels[0]} scale={1} />
        </div>
      </AbsoluteFill>

      {labels.slice(1).map((label, i) => (
        <Callout
          key={`${label}-${i}`}
          label={label}
          x={120 + i * 260}
          y={720 + i * 90}
          opacity={progress > 0.18 ? 1 : 0}
        />
      ))}

      <Vignette />
      <SceneLabel scene={scene} design={design} seconds={seconds} />
      <KaraokeCaption
        scene={{
          ...scene,
          words: scene.words ?? fallbackWords(scene.narration ?? "", scene.audio?.seconds ?? durationInFrames / FPS),
        }}
        design={design}
        seconds={seconds}
      />
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC<{ design: Design; progress: number }> = ({ design, progress }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 6,
      background: alpha(design.text, 0.1),
    }}
  >
    <div
      style={{
        width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
        height: "100%",
        background: `linear-gradient(90deg, ${design.accent}, ${design.accent2})`,
      }}
    />
  </div>
);

/**
 * URL audio yang benar di dua lingkungan:
 * - render CLI: `staticFile()` membaca `public/`
 * - Player di browser: lewat `/api/audio/...`
 */
const sceneAudioSrc = (src: string): string => {
  // Audio bisa berupa URL absolut (Blob/proxy) atau data URL hasil embed sandbox.
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  const clean = src.replace(/^\//, "");
  if (getRemotionEnvironment().isRendering) return staticFile(clean);
  return `/api/${clean}`;
};

const MusicBed: React.FC<{ src: string; durationInFrames: number }> = ({ src, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 30], [0, 0.14], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 45, durationInFrames], [0.14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <Audio src={sceneAudioSrc(src)} volume={Math.min(fadeIn, fadeOut)} />;
};

export const ShortVideo: React.FC<ShortVideoProps> = ({ plan }) => {
  const design = getDesign(plan.styleId);
  const frame = useCurrentFrame();
  const timings = computeSceneTimings(plan);
  const total = totalFramesFor(plan);

  return (
    <AbsoluteFill
      style={{
        fontFamily: design.body,
        color: design.text,
        background: `linear-gradient(180deg, ${design.bgFrom} 0%, ${design.bgTo} 100%)`,
      }}
    >
      {timings.map(({ scene, from, durationInFrames: sceneFrames, index }) => (
        <Sequence
          key={`${index}-${scene.template}`}
          from={from}
          durationInFrames={sceneFrames}
          name={`${index + 1}. ${scene.visual ?? scene.template}`}
        >
          <SceneSlot
            scene={scene}
            design={design}
            durationInFrames={sceneFrames}
            index={index}
          />
        </Sequence>
      ))}

      <ProgressBar design={design} progress={frame / Math.max(1, total - 1)} />

      {timings.map(({ scene, from, durationInFrames: sceneFrames, index }) =>
        scene.audio ? (
          <Sequence
            key={`audio-${index}`}
            from={from}
            durationInFrames={sceneFrames}
            name={`audio ${index + 1}`}
          >
            <Audio src={sceneAudioSrc(scene.audio.src)} volume={1} />
          </Sequence>
        ) : null,
      )}

      {plan.music ? <MusicBed src={plan.music} durationInFrames={total} /> : null}
    </AbsoluteFill>
  );
};
