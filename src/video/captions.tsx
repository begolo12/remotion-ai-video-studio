import React from "react";
import type { Scene } from "../lib/plan/schema";
import { SAFE, alpha, getDesign, type Design } from "./design";

/**
 * Caption karaoke ala referensi (shorts "Perjalanan Bensin"):
 * - kumpulan kata, bukan potongan 3 kata statis;
 * - kata yang sedang dibaca kuning + sedikit membesar;
 * - kata berikutnya kuning redup;
 * - label bab di kiri atas: dot kuning + judul + subjudul + chip keyword.
 */

const outline = (color: string): string =>
  [
    `-3px 0 0 ${color}`,
    `3px 0 0 ${color}`,
    `0 -3px 0 ${color}`,
    `0 3px 0 ${color}`,
    `-2px -2px 0 ${color}`,
    `2px -2px 0 ${color}`,
    `-2px 2px 0 ${color}`,
    `2px 2px 0 ${color}`,
    `0 8px 22px rgba(0,0,0,0.5)`,
  ].join(", ");

const HIGHLIGHT = "#FFD21C";

export type SceneLabelProps = {
  scene: Scene;
  design: Design;
  /** Detik relatif scene, dipakai untuk muncul bertahap. */
  seconds: number;
};

export const SceneLabel: React.FC<SceneLabelProps> = ({ scene, design, seconds }) => {
  const chapter = scene.chapter ?? "";
  const sub = scene.chapterSub ?? "";
  const keyword = scene.keyword ?? "";
  if (!chapter && !sub) return null;

  const appear = Math.min(1, Math.max(0, seconds / 0.35));

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        top: SAFE.top - 90,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 14}px)`,
        pointerEvents: "none",
        textShadow: `-2px -2px 0 ${alpha(design.bgFrom, 0.85)}, 2px -2px 0 ${alpha(design.bgFrom, 0.85)}, -2px 2px 0 ${alpha(design.bgFrom, 0.85)}, 2px 2px 0 ${alpha(design.bgFrom, 0.85)}, 0 3px 10px rgba(0,0,0,0.55)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: HIGHLIGHT,
            boxShadow: `0 0 16px ${alpha(HIGHLIGHT, 0.6)}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: design.body,
            fontSize: 31,
            fontWeight: 800,
            letterSpacing: 0.6,
            color: "#ffffff",
          }}
        >
          {chapter}
        </span>
      </div>
      {sub || keyword ? (
        <div
          style={{
            paddingLeft: 32,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: design.body,
            fontSize: 27,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          <span>{sub}</span>
          {keyword ? (
            <span
              style={{
                background: HIGHLIGHT,
                color: "#20262b",
                padding: "2px 10px",
                borderRadius: 4,
                fontSize: 25,
              }}
            >
              {keyword}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export type KaraokeCaptionProps = {
  scene: Scene;
  design?: Design;
  styleId?: Scene extends never ? never : "cinematic" | "neon" | "minimal" | "bold" | "retro";
  /** Detik relatif terhadap scene. */
  seconds: number;
};

export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
  scene,
  design,
  styleId,
  seconds,
}) => {
  const d = design ?? getDesign(styleId ?? "cinematic");
  const words = scene.words ?? [];
  if (words.length === 0) return null;

  let active = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (seconds >= words[i].s) active = i;
    else break;
  }

  // Jendela 14 kata terakhir supaya baris tidak menutup ilustrasi.
  const start = Math.max(0, active - 13);
  const end = Math.min(words.length - 1, active + 1);
  const visible: Array<{ word: string; state: "done" | "active" | "next" }> = [];

  for (let i = start; i <= end; i += 1) {
    visible.push({
      word: words[i].t,
      state: i < active ? "done" : i === active ? "active" : "next",
    });
  }

  if (visible.length === 0) return null;

  const last = words[words.length - 1];
  const fading = last && seconds > last.e && seconds < last.e + 0.18;
  const fade = fading ? Math.min(1, (last.e + 0.18 - seconds) / 0.18) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left - 40,
        right: SAFE.left - 40,
        bottom: SAFE.captionBottom + 60,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        gap: "0 12px",
        opacity: fade,
        pointerEvents: "none",
        textShadow: outline(alpha(d.bgFrom, 0.92)),
      }}
    >
      {visible.map(({ word, state }, index) => (
        <span
          key={`${index}-${word}`}
          style={{
            display: "inline-block",
            fontFamily: d.body,
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: 0.4,
            color: state === "done" ? "#ffffff" : HIGHLIGHT,
            opacity: state === "next" ? 0.45 : 1,
            transform: state === "active" ? "scale(1.06)" : "scale(1)",
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
};

export const fallbackWords = (text: string, seconds: number): Scene["words"] => {
  const parts = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || seconds <= 0) return [];
  const weights = parts.map((part) => part.length + 1);
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return parts.map((t, index) => {
    const span = index === parts.length - 1 ? seconds - cursor : Math.max(0.08, (weights[index] / total) * seconds);
    const word = { t, s: Number(cursor.toFixed(3)), e: Number(Math.min(seconds, cursor + span).toFixed(3)) };
    cursor += span;
    return word;
  });
};

/** Dipertahankan untuk komposisi lama tanpa word timing. */
export const CaptionScrim: React.FC<{ design: Design }> = ({ design }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 560,
      background: `linear-gradient(180deg, transparent 0%, ${alpha(design.bgFrom, 0.4)} 62%, ${alpha(design.bgFrom, 0.72)} 100%)`,
      pointerEvents: "none",
    }}
  />
);
