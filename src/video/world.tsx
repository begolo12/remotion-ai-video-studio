import React from "react";
import { AbsoluteFill } from "remotion";
import type { StyleId } from "../lib/plan/schema";
import { alpha, getDesign, type Design } from "./design";

/**
 * Latar "dunia" yang terus bergerak dan TIDAK ikut di-fade saat transisi scene.
 * Kalau latar ikut fade, mata membaca "frame jadi gelap lalu terang", bukan
 * transisi. Semua lapisan bergerak dengan faktor parallax berbeda.
 */

const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
  <rect width="180" height="180" filter="url(#n)" opacity="0.55"/>
</svg>`;

const NOISE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(NOISE_SVG)}`;

const Blob: React.FC<{
  color: string;
  size: number;
  left: string;
  top: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
}> = ({ color, size, left, top, opacity, x, y, blur }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 50% 50%, ${alpha(color, 0.55)} 0%, ${alpha(color, 0.16)} 42%, transparent 70%)`,
      filter: blur > 0 ? `blur(${blur}px)` : undefined,
      transform: `translate3d(${x}px, ${y}px, 0)`,
      opacity,
    }}
  />
);

export type WorldProps = {
  styleId: StyleId;
  /** Frame global (kumulatif sepanjang video), bukan frame scene. */
  frame: number;
  durationInFrames: number;
  design?: Design;
};

export const World: React.FC<WorldProps> = ({ styleId, frame, durationInFrames, design }) => {
  const d = design ?? getDesign(styleId);
  const total = Math.max(2, durationInFrames - 1);
  const t = Math.min(1, frame / total);

  // Satu sumbu monotonic + satu sumbu sinus (aturan drift).
  const driftA = 46 * t + 18 * Math.sin(frame / 150);
  const driftB = -58 * t + 22 * Math.sin(frame / 190 + 1.2);
  const driftC = 30 * t + 14 * Math.sin(frame / 120 + 2.4);

  // Grid bergerak lambat ke satu arah supaya tidak terasa beku.
  const gridShift = (frame * 0.35) % 96;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(168deg, ${d.bgFrom} 0%, ${d.bgTo} 100%)` }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Blob
          color={d.blobs[0]}
          size={1080}
          left="-32%"
          top="-14%"
          opacity={0.5 + d.glow * 0.2}
          x={driftA}
          y={driftB * 0.6}
          blur={90}
        />
        <Blob
          color={d.blobs[1]}
          size={880}
          left="34%"
          top="42%"
          opacity={0.32 + d.glow * 0.18}
          x={driftB}
          y={driftC}
          blur={100}
        />
        <Blob
          color={d.blobs[2]}
          size={720}
          left="-14%"
          top="64%"
          opacity={0.24 + d.glow * 0.14}
          x={driftC}
          y={driftA * 0.7}
          blur={110}
        />
      </AbsoluteFill>

      {d.gridOn ? (
        <AbsoluteFill
          style={{
            opacity: d.gridOpacity,
            backgroundImage: `linear-gradient(${d.grid} 1px, transparent 1px), linear-gradient(90deg, ${d.grid} 1px, transparent 1px)`,
            backgroundSize: "96px 96px",
            backgroundPosition: `0px ${gridShift}px, ${gridShift}px 0px`,
            maskImage: "radial-gradient(120% 90% at 50% 30%, black 20%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(120% 90% at 50% 30%, black 20%, transparent 78%)",
          }}
        />
      ) : null}

      {/* Sapuan cahaya diagonal tipis: memberi kesan "image", bukan slide. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${115 + Math.sin(frame / 240) * 6}deg, transparent 38%, ${alpha(d.accent, 0.06)} 50%, transparent 62%)`,
        }}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(78% 62% at 50% 42%, transparent 38%, ${alpha("#000000", d.vignette)} 100%)`,
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage: `url("${NOISE_URL}")`,
          backgroundRepeat: "repeat",
          opacity: d.grain,
          transform: `translate(${(frame * 7) % 180}px, ${(frame * 11) % 180}px)`,
          mixBlendMode: d.lightSurface ? "multiply" : "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
