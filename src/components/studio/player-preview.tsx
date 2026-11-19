"use client";

import dynamic from "next/dynamic";
import type { ComponentType, CSSProperties } from "react";
import type { VideoPlan } from "@/lib/plan/schema";
import { totalFramesFor } from "@/lib/plan/timing";
import { ShortVideo } from "@/video/ShortVideo";

type StudioPlayerProps = {
  component: ComponentType<{ plan: VideoPlan }>;
  inputProps: { plan: VideoPlan };
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  style?: CSSProperties;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  acknowledgeRemotionLicense?: boolean;
  className?: string;
};

function PlayerSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex aspect-[9/16] w-full items-center justify-center bg-[radial-gradient(120%_90%_at_20%_0%,#1b2333_0%,#0b0e16_55%,#05060a_100%)]"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
    </div>
  );
}

// Player Remotion memakai API browser, jadi hanya dimuat di klien.
const Player = dynamic(
  () =>
    import("@remotion/player").then(
      (mod) => mod.Player as unknown as ComponentType<StudioPlayerProps>,
    ),
  { ssr: false, loading: () => <PlayerSkeleton /> },
);

type PlayerPreviewProps = {
  plan: VideoPlan;
  isSample: boolean;
};

export function PlayerPreview({ plan, isSample }: PlayerPreviewProps) {
  const frames = totalFramesFor(plan);

  return (
    <div
      data-testid="preview-player"
      className="relative mx-auto w-full max-w-[330px]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-5 rounded-[2.2rem] bg-amber-400/10 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/70">
        <Player
          key={`${plan.styleId}-${plan.targetSeconds}-${plan.scenes.length}-${plan.title}`}
          component={ShortVideo}
          inputProps={{ plan }}
          durationInFrames={frames}
          fps={30}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: "100%", aspectRatio: "9/16" }}
          controls
          autoPlay
          loop
          acknowledgeRemotionLicense
        />
        {isSample ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-amber-300/40 bg-zinc-950/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200 backdrop-blur">
            Contoh
          </span>
        ) : null}
      </div>
    </div>
  );
}
