import React from "react";
import { FPS } from "../../lib/plan/schema";
import { countUp, fadeUp, springIn } from "../anim";
import { alpha, displayWeight } from "../design";
import { WRAP, fitSize } from "../typography";
import { Kicker, SceneShell } from "./shell";
import type { SceneProps } from "./types";

type Parsed = { prefix: string; number: number; decimals: number; suffix: string } | null;

const parseValue = (value: string): Parsed => {
  const match = /^(\D*?)(\d[\d.,]*)(.*)$/.exec(value.trim());
  if (!match) return null;
  const raw = match[2];
  const normalized = raw.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  const decimals = normalized.includes(".") ? normalized.split(".")[1].length : 0;
  return { prefix: match[1], number, decimals, suffix: match[3] };
};

const RING = 620;
const STROKE = 14;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Lebar aman teks di dalam ring (ring 620 dikurangi dua stroke). */
const VALUE_MAX_WIDTH = 520;

/**
 * Estimasi lebar teks relatif terhadap font-size. Angka dan "%" sempit,
 * huruf lebar; tanpa ini "20 menit" meluber keluar ring.
 */
const widthFactor = (text: string): number => {
  let factor = 0;
  for (const char of text) {
    if (/\d/.test(char)) factor += 0.56;
    else if (/[%.,:]/.test(char)) factor += 0.3;
    else if (/\s/.test(char)) factor += 0.26;
    else if (/[A-Z]/.test(char)) factor += 0.72;
    else factor += 0.55;
  }
  return Math.max(0.5, factor);
};

export const StatScene: React.FC<SceneProps> = ({ scene, design, frame }) => {
  const value = scene.value ?? scene.heading ?? "";
  const label = scene.label ?? "";
  const kicker = scene.text ?? "";

  const intro = frame + 3;
  const ring = springIn(intro, FPS, 0);
  const valueIn = springIn(intro, FPS, 4);
  const labelIn = fadeUp(intro, FPS, 8, 22);

  if (!value && !label) return null;

  const parsed = parseValue(value);
  const percent =
    parsed && parsed.suffix.trim().startsWith("%")
      ? Math.min(100, Math.max(0, parsed.number))
      : 0.74;

  const displayed = parsed
    ? (() => {
        const current = countUp(parsed.number, intro, FPS, 4);
        const formatted =
          parsed.decimals > 0
            ? current.toFixed(parsed.decimals)
            : Math.round(current).toLocaleString("id-ID");
        return `${parsed.prefix}${formatted}${parsed.suffix}`;
      })()
    : value;

  const dash = CIRCUMFERENCE * (1 - Math.min(1, (percent / 100) * ring.scale));

  const size = fitSize(
    displayed,
    [
      { minLength: 11, size: 168 },
      { minLength: 8, size: 196 },
      { minLength: 6, size: 216 },
    ],
    250,
  );
  // Batasi ukuran supaya teks selalu masuk ring (termasuk satuan seperti "menit").
  const fitted = Math.min(size, Math.floor(VALUE_MAX_WIDTH / widthFactor(displayed)));

  const valueBlock = (
    <div
      style={{
        maxWidth: VALUE_MAX_WIDTH,
        padding: "0 6px",
        fontFamily: design.display,
        fontSize: fitted,
        fontWeight: displayWeight(design),
        lineHeight: 1.02,
        letterSpacing: "-0.02em",
        color: design.text,
        textAlign: "center",
        ...WRAP,
        transform: `scale(${valueIn.scale})`,
        opacity: valueIn.opacity,
      }}
    >
      {displayed}
    </div>
  );

  return (
    <SceneShell design={design} align="center" textAlign="center">
      {kicker ? <Kicker design={design} opacity={labelIn.opacity}>{kicker}</Kicker> : null}

      {parsed ? (
        <div
          style={{
            position: "relative",
            width: RING,
            height: RING,
            display: "grid",
            placeItems: "center",
            transform: `scale(${0.96 + 0.04 * ring.scale})`,
            opacity: ring.opacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -70,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${alpha(design.accent, 0.22 * design.glow)} 0%, transparent 62%)`,
            }}
          />

          <svg
            width={RING}
            height={RING}
            style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
          >
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              fill="none"
              stroke={alpha(design.text, 0.12)}
              strokeWidth={STROKE}
            />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              fill="none"
              stroke={design.accent}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dash}
            />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS - 34}
              fill="none"
              stroke={alpha(design.accent2, 0.35)}
              strokeWidth={3}
              strokeDasharray="2 14"
            />
          </svg>

          {valueBlock}
        </div>
      ) : (
        valueBlock
      )}

      {label ? (
        <p
          style={{
            margin: 0,
            marginTop: parsed ? 44 : 28,
            maxWidth: 760,
            fontFamily: design.body,
            fontSize: 44,
            lineHeight: 1.32,
            fontWeight: 500,
            color: design.textMuted,
            ...WRAP,
            ...labelIn,
          }}
        >
          {label}
        </p>
      ) : null}
    </SceneShell>
  );
};

export default StatScene;
