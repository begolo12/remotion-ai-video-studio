import React from "react";
import { AbsoluteFill } from "remotion";
import { SAFE } from "../design";
import type { Design } from "../design";

/** Padding area konten: di dalam safe zone, menyisakan ruang untuk caption. */
export const scenePadding = `0 ${SAFE.left}px`;

export type SceneShellProps = {
  children: React.ReactNode;
  design: Design;
  align?: "center" | "flex-start";
  textAlign?: "center" | "left";
  justify?: "center" | "flex-end" | "flex-start";
};

/**
 * Kerangka semua scene: kotak aman 9:16 (atas 212, bawah 1380) dan lebar
 * 904px sehingga tidak menabrak kolom tombol platform di kanan.
 */
export const SceneShell: React.FC<SceneShellProps> = ({
  children,
  align = "flex-start",
  textAlign = "left",
  justify = "center",
}) => {
  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE.top + 28}px ${SAFE.left}px ${1920 - SAFE.contentBottom}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: align,
        textAlign,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Label kecil di atas headline (kicker). */
export const Kicker: React.FC<{
  children: React.ReactNode;
  design: Design;
  opacity?: number;
}> = ({ children, design, opacity = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginBottom: 28,
      fontFamily: design.body,
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: design.accent,
      opacity,
    }}
  >
    <span
      style={{
        width: 34,
        height: 4,
        borderRadius: 999,
        background: design.accent,
      }}
    />
    {children}
  </div>
);

/** Garis aksen yang tumbuh dari kiri. */
export const AccentRule: React.FC<{
  design: Design;
  progress: number;
  width?: number;
  height?: number;
  opacity?: number;
  marginTop?: number;
  marginBottom?: number;
}> = ({ design, progress, width = 132, height = 8, opacity = 1, marginTop = 0, marginBottom = 34 }) => (
  <div
    style={{
      width,
      height,
      marginTop,
      marginBottom,
      borderRadius: 999,
      background: `linear-gradient(90deg, ${design.accent}, ${design.accent2})`,
      transform: `scaleX(${Math.max(0, Math.min(1, progress))})`,
      transformOrigin: "left center",
      opacity,
    }}
  />
);
