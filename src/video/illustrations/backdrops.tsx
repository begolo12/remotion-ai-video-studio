import React, { useId } from "react";
import { AbsoluteFill } from "remotion";
import type { Design } from "../design";
import { alpha } from "../design";

/**
 * Latar ilustrasi explainer 2D flat. Semua SVG memakai viewBox penuh
 * 1080x1920 dan tidak bergantung pada frame Remotion, sehingga aman dipakai
 * di Player maupun di render statis.
 */

type SkyVariant = "day" | "pale" | "space" | "warm";

const SKY_STOPS: Record<SkyVariant, [string, string, string]> = {
  day: ["#4d9fd6", "#a6d6ea", "#edf5f6"],
  pale: ["#79b7d9", "#c9e2ec", "#f5f8f4"],
  warm: ["#5ca8d2", "#d6e6d9", "#e9d6b2"],
  space: ["#111a35", "#0a1022", "#05070f"],
};

const CLOUDS = [
  { x: 180, y: 300, s: 1.1 },
  { x: 830, y: 230, s: 0.9 },
  { x: 560, y: 480, s: 1.25 },
  { x: 300, y: 720, s: 0.78 },
  { x: 930, y: 660, s: 1.0 },
];

export const Sky: React.FC<{ design: Design; variant?: SkyVariant }> = ({
  design,
  variant = "day",
}) => {
  const stops = SKY_STOPS[variant];

  // CSS gradient penuh (bukan SVG) supaya tidak bergantung pada viewBox scaling
  // yang bisa berbeda antara still dan render video.
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${variant === "space" ? design.bgFrom : stops[0]} 0%, ${stops[1]} 55%, ${variant === "space" ? "#05070f" : stops[2]} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 76% 19%, ${alpha(design.accent, 0.16)} 0%, transparent 30%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Clouds: React.FC<{ design: Design; opacity?: number }> = ({
  design,
  opacity = 0.78,
}) => (
  <svg
    width={1080}
    height={1920}
    viewBox="0 0 1080 1920"
    opacity={opacity}
  >
    <g fill="#ffffff">
      {CLOUDS.map((cloud, i) => (
        <g
          key={i}
          transform={`translate(${cloud.x} ${cloud.y}) scale(${cloud.s})`}
          opacity={0.42 + (i % 3) * 0.1}
        >
          <ellipse cx="0" cy="0" rx="118" ry="32" />
          <ellipse cx="-58" cy="-18" rx="60" ry="36" />
          <ellipse cx="52" cy="-24" rx="74" ry="40" />
          <ellipse cx="108" cy="4" rx="56" ry="25" />
        </g>
      ))}
    </g>
    <g fill={alpha(design.accent, 0.1)}>
      {CLOUDS.map((cloud, i) => (
        <g
          key={`tint-${i}`}
          transform={`translate(${cloud.x} ${cloud.y + 18}) scale(${cloud.s})`}
        >
          <ellipse cx="0" cy="12" rx="110" ry="22" />
        </g>
      ))}
    </g>
  </svg>
);

export const Ground: React.FC<{
  design: Design;
  top?: number;
  grass?: boolean;
}> = ({ design, top = 1010, grass = true }) => {
  const uid = useId().replace(/:/g, "");
  const tufts = [110, 280, 460, 640, 820, 990];

  return (
    <svg
      width={1080}
      height={1920}
      viewBox="0 0 1080 1920"
    >
      <defs>
        <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={grass ? "#8fbe5a" : "#c8b48d"} />
          <stop offset="100%" stopColor={grass ? "#4e7d33" : "#8e7a57"} />
        </linearGradient>
      </defs>
      <path
        d={`M 0 ${top} Q 270 ${top - 34} 540 ${top} T 1080 ${top} L 1080 1920 L 0 1920 Z`}
        fill={`url(#${uid}-ground)`}
      />
      {grass && (
        <g>
          {tufts.map((x, i) => (
            <g
              key={x}
              transform={`translate(${x} ${top + 42 + (i % 2) * 26})`}
            >
              <path
                d="M 0 0 Q -12 -38 -30 -54"
                fill="none"
                stroke="#5b7e3d"
                strokeWidth={9}
                strokeLinecap="round"
              />
              <path
                d="M 0 0 Q 4 -44 4 -66"
                fill="none"
                stroke="#6f9c48"
                strokeWidth={9}
                strokeLinecap="round"
              />
              <path
                d="M 0 0 Q 14 -36 32 -50"
                fill="none"
                stroke="#79b057"
                strokeWidth={9}
                strokeLinecap="round"
              />
              <circle cx="4" cy="-72" r="15" fill={design.accent} opacity={0.85} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
};

export const Ocean: React.FC<{
  design: Design;
  top?: number;
  drift?: number;
}> = ({ design, top = 1000, drift = 0 }) => {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={1080}
      height={1920}
      viewBox="0 0 1080 1920"
    >
      <defs>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#57b8e6" />
          <stop offset="100%" stopColor="#0d4f86" />
        </linearGradient>
      </defs>
      <rect y={top} width="1080" height={1920 - top} fill={`url(#${uid}-sea)`} />
      <g
        transform={`translate(${drift} 0)`}
        fill="none"
        stroke={alpha("#ffffff", 0.5)}
        strokeWidth={5}
        strokeLinecap="round"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path
            key={i}
            d={`M ${-220 + i * 180} ${top + 60 + (i % 3) * 90} q 45 -16 90 0 q 45 16 90 0`}
          />
        ))}
      </g>
      <g
        fill="none"
        stroke={design.accent}
        strokeWidth={4}
        opacity={0.32}
        strokeLinecap="round"
      >
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M 0 ${top + 190 + i * 230} q 120 -24 240 0 t 240 0 t 240 0 t 240 0 t 240 0`}
          />
        ))}
      </g>
    </svg>
  );
};

export const Road: React.FC<{ design: Design; top?: number }> = ({
  design,
  top = 1050,
}) => {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={1080}
      height={1920}
      viewBox="0 0 1080 1920"
    >
      <defs>
        <linearGradient id={`${uid}-road`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b9296" />
          <stop offset="100%" stopColor="#41484c" />
        </linearGradient>
      </defs>
      <rect y={top} width="1080" height={1920 - top} fill={`url(#${uid}-road)`} />
      <rect x="132" y={top} width="12" height={1920 - top} fill={alpha(design.accent, 0.55)} />
      <rect x="936" y={top} width="12" height={1920 - top} fill={alpha(design.accent, 0.55)} />
      <g fill="#e8c72c">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={462}
            y={top + 90 + i * 180}
            width="156"
            height="24"
            rx="8"
          />
        ))}
      </g>
    </svg>
  );
};

export const Stars: React.FC<{ design: Design }> = ({ design }) => (
  <svg
    width={1080}
    height={1920}
    viewBox="0 0 1080 1920"
  >
    {Array.from({ length: 110 }).map((_, i) => (
      <circle
        key={i}
        cx={(i * 137 + 29) % 1080}
        cy={(i * 91 + 13) % 1720}
        r={i % 9 === 0 ? 3 : 1.6}
        fill={i % 13 === 0 ? design.accent : "#ffffff"}
        opacity={0.28 + ((i * 17) % 60) / 100}
      />
    ))}
  </svg>
);

export const Vignette: React.FC = () => {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={1080}
      height={1920}
      viewBox="0 0 1080 1920"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <radialGradient id={`${uid}-vignette`} cx="50%" cy="45%" r="72%">
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.34} />
        </radialGradient>
      </defs>
      <rect width="1080" height="1920" fill={`url(#${uid}-vignette)`} />
    </svg>
  );
};

/** Label kecil kuning ala referensi; diposisikan relatif terhadap kontainer. */
export const Callout: React.FC<{
  label: string;
  x?: number;
  y?: number;
  color?: string;
  opacity?: number;
}> = ({
  label,
  x = 0,
  y = 0,
  color = "#ffd21c",
  opacity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      background: color,
      color: "#20262b",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 800,
      fontSize: 24,
      lineHeight: 1,
      padding: "8px 14px",
      borderRadius: 4,
      boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
    }}
  >
    {label}
  </div>
);
