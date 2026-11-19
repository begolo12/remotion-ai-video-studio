import React, { useId } from "react";
import type { VisualKind } from "../../lib/plan/schema";
import type { Design } from "../design";
import { alpha } from "../design";

/**
 * Pustaka objek ilustrasi explainer 2D flat.
 * Semua komponen deterministik terhadap `progress` (0..1) dan hanya memakai
 * useId() untuk gradient — tidak ada useCurrentFrame(), aman di Remotion Player.
 */

export type ObjectProps = {
  design: Design;
  /** 0..1, progres scene; dipakai untuk mengisi tangki, menaikkan grafik, dll. */
  progress: number;
  /** Label callout opsional di dekat objek. */
  label?: string;
  scale?: number;
};

const W = 720;
const H = 560;

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const frame = (scale = 1) => ({
  width: W * scale,
  height: H * scale,
  viewBox: `0 0 ${W} ${H}`,
  style: { overflow: "visible" as const },
});

const quad = (
  a: { x: number; y: number },
  c: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
) => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

/** Tag kuning di dalam viewBox objek; lebarnya dibatasi agar tidak keluar kanvas. */
const Tag: React.FC<{ text?: string; x?: number; y?: number }> = ({
  text,
  x = 360,
  y = 46,
}) => {
  if (!text) return null;
  const width = Math.max(84, Math.min(460, text.length * 17 + 32));
  const cx = Math.min(W - width / 2 - 10, Math.max(width / 2 + 10, x));
  return (
    <g transform={`translate(${cx} ${y})`}>
      <rect
        x={-width / 2}
        y={-25}
        width={width}
        height={50}
        rx={6}
        fill="#ffd21c"
      />
      <text
        x={0}
        y={9}
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={23}
        fontWeight={800}
        fill="#20262b"
      >
        {text}
      </text>
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* vehicle                                                            */
/* ------------------------------------------------------------------ */
export const Vehicle: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const spin = (clamp01(progress) * 420).toFixed(2);

  const wheel = (cx: number, cy: number) => (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={84} fill="#15181b" />
      <circle r={66} fill="none" stroke={alpha("#ffffff", 0.28)} strokeWidth={7} />
      <g
        transform={`rotate(${spin})`}
        stroke={alpha("#ffffff", 0.55)}
        strokeWidth={7}
        strokeLinecap="round"
      >
        {[0, 60, 120].map((deg) => (
          <line
            key={deg}
            x1={0}
            y1={-16}
            x2={0}
            y2={-60}
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
      <circle r={20} fill={design.accent} />
      <circle r={9} fill={alpha("#ffffff", 0.85)} />
    </g>
  );

  return (
    <svg {...frame(scale)}>
      <defs>
        <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={design.accent} />
          <stop offset="100%" stopColor={design.accent2} />
        </linearGradient>
      </defs>
      <ellipse cx={360} cy={500} rx={300} ry={18} fill={alpha("#000000", 0.18)} />
      {wheel(188, 410)}
      {wheel(548, 410)}
      <path
        d="M 120 330 Q 150 268 232 262 L 320 262 L 352 210 L 470 210 Q 520 212 548 268 L 588 320 L 548 356 L 160 356 Z"
        fill={`url(#${id("body")})`}
      />
      <path d="M 210 276 L 320 276 L 300 320 L 186 320 Z" fill={alpha("#ffffff", 0.22)} />
      <path d="M 332 262 L 458 250 L 492 320 L 336 320 Z" fill={alpha("#000000", 0.16)} />
      <path d="M 150 258 L 300 252 Q 310 250 306 264 L 150 272 Z" fill="#20262b" />
      <ellipse cx={392} cy={252} rx={58} ry={16} fill={alpha("#ffffff", 0.3)} />
      <path
        d="M 512 226 L 556 176 L 606 176"
        fill="none"
        stroke={design.text}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={606} cy={252} r={30} fill={alpha(design.accent, 0.25)} />
      <circle
        cx={606}
        cy={252}
        r={19}
        fill="#fff3c4"
        stroke={alpha("#ffffff", 0.8)}
        strokeWidth={4}
      />
      <path
        d="M 180 372 L 300 372"
        stroke={alpha("#ffffff", 0.5)}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* container                                                          */
/* ------------------------------------------------------------------ */
export const Container: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const surface = 470 - p * 310;

  return (
    <svg {...frame(scale)}>
      <defs>
        <linearGradient id={id("liquid")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={design.accent} />
          <stop offset="100%" stopColor={design.accent2} />
        </linearGradient>
        <linearGradient id={id("steel")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={alpha("#ffffff", 0.22)} />
          <stop offset="35%" stopColor={alpha("#ffffff", 0.5)} />
          <stop offset="100%" stopColor={alpha("#000000", 0.18)} />
        </linearGradient>
        <clipPath id={id("inside")}>
          <rect x={168} y={150} width={384} height={320} rx={18} />
        </clipPath>
      </defs>
      <ellipse cx={360} cy={492} rx={230} ry={16} fill={alpha("#000000", 0.18)} />
      <rect
        x={340}
        y={96}
        width={40}
        height={56}
        rx={6}
        fill={alpha("#ffffff", 0.35)}
        stroke={alpha("#ffffff", 0.5)}
        strokeWidth={3}
      />
      <rect
        x={168}
        y={150}
        width={384}
        height={320}
        rx={18}
        fill={alpha("#ffffff", 0.16)}
        stroke={alpha("#ffffff", 0.45)}
        strokeWidth={4}
      />
      <g clipPath={`url(#${id("inside")})`}>
        <rect
          x={168}
          y={surface}
          width={384}
          height={480 - surface}
          fill={`url(#${id("liquid")})`}
        />
        <ellipse cx={360} cy={surface} rx={192} ry={18} fill={design.accent} />
        <ellipse
          cx={360}
          cy={surface}
          rx={192}
          ry={18}
          fill={alpha("#ffffff", 0.14)}
        />
      </g>
      <rect
        x={168}
        y={150}
        width={384}
        height={320}
        rx={18}
        fill={`url(#${id("steel")})`}
      />
      <path
        d="M 168 470 L 552 470"
        stroke={alpha("#000000", 0.25)}
        strokeWidth={6}
      />
      <rect x={590} y={160} width={16} height={300} rx={8} fill={alpha("#000000", 0.28)} />
      <rect
        x={590}
        y={460 - p * 290}
        width={16}
        height={p * 290}
        rx={8}
        fill={design.accent}
      />
      {[200, 266, 332, 398].map((y) => (
        <line
          key={y}
          x1={612}
          y1={y}
          x2={634}
          y2={y}
          stroke={alpha("#ffffff", 0.6)}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* factory                                                            */
/* ------------------------------------------------------------------ */
export const Factory: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const barHeight = p * 168;

  return (
    <svg {...frame(scale)}>
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={alpha("#ffffff", 0.46)} />
          <stop offset="100%" stopColor={alpha("#000000", 0.22)} />
        </linearGradient>
      </defs>
      <ellipse cx={360} cy={498} rx={296} ry={16} fill={alpha("#000000", 0.16)} />
      <g fill={alpha("#ffffff", 0.34)}>
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={506 + i * 20 - (i % 2) * 14}
            cy={92 - i * 32 - p * 26}
            r={24 - i * 4}
            opacity={0.8 - i * 0.2}
          />
        ))}
      </g>
      <rect x={474} y={110} width={66} height={172} rx={6} fill={alpha("#000000", 0.24)} />
      <rect x={466} y={102} width={82} height={18} rx={6} fill={alpha("#ffffff", 0.45)} />
      <rect x={492} y={122} width={14} height={150} fill={alpha(design.accent, 0.45)} />
      <path
        d="M 104 282 L 176 226 L 240 282 L 312 226 L 376 282 L 448 226 L 512 282 L 512 466 L 104 466 Z"
        fill={`url(#${id("wall")})`}
        stroke={alpha("#ffffff", 0.4)}
        strokeWidth={3}
      />
      <path d="M 104 282 L 176 226 L 240 282 L 176 292 Z" fill={alpha(design.accent, 0.5)} />
      <path d="M 240 282 L 312 226 L 376 282 L 312 292 Z" fill={alpha(design.accent2, 0.5)} />
      <path d="M 376 282 L 448 226 L 512 282 L 448 292 Z" fill={alpha(design.accent, 0.5)} />
      {[152, 264, 376].map((x) => (
        <g key={x}>
          <rect x={x} y={340} width={78} height={86} rx={8} fill={alpha("#000000", 0.3)} />
          <rect
            x={x + 8}
            y={348}
            width={62}
            height={70}
            rx={5}
            fill={alpha(design.accent, 0.35 + p * 0.45)}
          />
          <line
            x1={x + 39}
            y1={348}
            x2={x + 39}
            y2={418}
            stroke={alpha("#ffffff", 0.4)}
            strokeWidth={4}
          />
        </g>
      ))}
      <rect x={610} y={290} width={30} height={180} rx={10} fill={alpha("#000000", 0.28)} />
      <rect
        x={610}
        y={470 - barHeight}
        width={30}
        height={barHeight}
        rx={10}
        fill={design.accent}
      />
      {[320, 360, 400, 440].map((y) => (
        <line
          key={y}
          x1={648}
          y1={y}
          x2={670}
          y2={y}
          stroke={alpha("#ffffff", 0.5)}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* ship                                                               */
/* ------------------------------------------------------------------ */
export const Ship: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const shift = p * 80;

  return (
    <svg {...frame(scale)}>
      <defs>
        <linearGradient id={id("hull")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={alpha("#ffffff", 0.3)} />
          <stop offset="100%" stopColor={alpha("#000000", 0.5)} />
        </linearGradient>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#57b8e6" />
          <stop offset="100%" stopColor="#0d4f86" />
        </linearGradient>
      </defs>
      <ellipse cx={360} cy={438} rx={300} ry={14} fill={alpha("#000000", 0.14)} />
      <rect x={552} y={168} width={78} height={104} rx={6} fill={alpha("#ffffff", 0.5)} />
      <rect x={552} y={168} width={78} height={12} rx={5} fill={alpha("#ffffff", 0.8)} />
      {[566, 590, 614].map((x) => (
        <rect key={x} x={x} y={190} width={16} height={22} rx={3} fill={alpha("#000000", 0.32)} />
      ))}
      <rect x={580} y={116} width={28} height={54} rx={4} fill={alpha("#000000", 0.32)} />
      <rect x={580} y={130} width={28} height={12} fill={design.accent2} />
      <path
        d="M 60 320 L 108 270 L 612 270 Q 646 272 640 320 L 612 388 Q 606 402 588 402 L 104 402 Q 84 398 78 380 Z"
        fill={`url(#${id("hull")})`}
        stroke={alpha("#ffffff", 0.35)}
        strokeWidth={3}
      />
      <path d="M 108 270 L 612 270 L 606 282 L 102 282 Z" fill={alpha("#ffffff", 0.65)} />
      <path d="M 112 386 L 600 386 L 592 398 L 120 398 Z" fill={alpha("#000000", 0.28)} />
      <g>
        <rect x={142} y={202} width={142} height={66} rx={5} fill={design.accent} />
        <rect x={296} y={202} width={142} height={66} rx={5} fill={design.accent2} />
        <rect x={450} y={202} width={92} height={66} rx={5} fill={design.accent} />
        {[142, 296, 450].map((x, i) => (
          <rect
            key={x}
            x={x + 8}
            y={210}
            width={i === 2 ? 76 : 126}
            height={10}
            rx={4}
            fill={alpha("#ffffff", 0.35)}
          />
        ))}
      </g>
      <path
        d="M 130 258 L 520 258 Q 540 258 540 240 L 540 202"
        fill="none"
        stroke={alpha("#ffffff", 0.55)}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <g transform={`translate(${shift} 0)`}>
        <path
          d={`M -120 406 q 45 -14 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 L 840 560 L -120 560 Z`}
          fill={`url(#${id("sea")})`}
          opacity={0.92}
        />
        <path
          d="M -120 406 q 45 -14 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0 t 90 0"
          fill="none"
          stroke={alpha("#ffffff", 0.6)}
          strokeWidth={5}
        />
      </g>
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* globe                                                              */
/* ------------------------------------------------------------------ */
export const Globe: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const a = { x: 244, y: 232 };
  const c = { x: 428, y: 176 };
  const b = { x: 478, y: 386 };
  const pos = quad(a, c, b, p);

  return (
    <svg {...frame(scale)}>
      <defs>
        <radialGradient id={id("ocean")} cx="36%" cy="30%" r="76%">
          <stop offset="0%" stopColor={alpha(design.accent, 0.85)} />
          <stop offset="100%" stopColor={alpha(design.accent2, 0.85)} />
        </radialGradient>
        <clipPath id={id("sphere")}>
          <circle cx={360} cy={292} r={212} />
        </clipPath>
      </defs>
      <ellipse cx={360} cy={306} rx={212} ry={212} fill={alpha("#000000", 0.16)} />
      <circle cx={360} cy={292} r={212} fill={`url(#${id("ocean")})`} />
      <g clipPath={`url(#${id("sphere")})`}>
        <path
          d="M 196 138 Q 252 118 300 142 Q 330 158 312 192 Q 290 226 304 262 Q 316 300 292 340 Q 274 372 288 410 Q 250 396 238 356 Q 226 314 242 274 Q 256 238 234 208 Q 210 176 196 138 Z"
          fill={alpha("#ffffff", 0.32)}
        />
        <path
          d="M 318 140 Q 366 122 410 136 Q 450 148 482 130 Q 512 116 536 142 Q 552 162 526 188 Q 490 214 454 206 Q 424 200 402 218 Q 374 240 346 218 Q 318 196 314 168 Z"
          fill={alpha("#ffffff", 0.26)}
        />
        <path
          d="M 440 370 Q 482 354 516 376 Q 536 390 522 412 Q 490 430 456 416 Q 434 404 440 370 Z"
          fill={alpha("#ffffff", 0.3)}
        />
        <g stroke={alpha("#ffffff", 0.32)} strokeWidth={2} fill="none">
          <ellipse cx={360} cy={292} rx={212} ry={72} />
          <ellipse cx={360} cy={292} rx={212} ry={144} />
          <line x1={360} y1={80} x2={360} y2={504} />
          <ellipse cx={360} cy={292} rx={78} ry={212} />
          <ellipse cx={360} cy={292} rx={156} ry={212} />
        </g>
        <path
          d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`}
          fill="none"
          stroke={alpha("#ffffff", 0.55)}
          strokeWidth={8}
          strokeLinecap="round"
        />
        <path
          d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`}
          fill="none"
          stroke="#ffd21c"
          strokeWidth={4}
          strokeDasharray="12 10"
          strokeLinecap="round"
        />
        {[a, b].map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={13} fill={alpha(design.accent, 0.3)} />
            <circle cx={pt.x} cy={pt.y} r={7} fill="#ffffff" stroke={design.accent} strokeWidth={3} />
          </g>
        ))}
        <g transform={`translate(${pos.x} ${pos.y})`}>
          <path d="M -18 -8 L 12 -8 L 22 0 L 12 8 L -18 8 Z" fill="#ff7043" stroke="#ffffff" strokeWidth={2} />
          <rect x={-6} y={-15} width={11} height={8} rx={2} fill="#ffffff" />
        </g>
      </g>
      <circle cx={360} cy={292} r={212} fill="none" stroke={alpha("#ffffff", 0.45)} strokeWidth={5} />
      <path
        d="M 202 162 Q 274 100 356 98"
        fill="none"
        stroke={alpha("#ffffff", 0.3)}
        strokeWidth={13}
        strokeLinecap="round"
      />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* pipeline                                                           */
/* ------------------------------------------------------------------ */
export const Pipeline: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const path =
    "M 40 420 L 168 420 Q 200 420 200 388 L 200 252 Q 200 220 232 220 L 488 220 Q 520 220 520 252 L 520 318 Q 520 350 552 350 L 680 350";

  return (
    <svg {...frame(scale)}>
      <defs>
        <linearGradient id={id("pipe")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={alpha("#ffffff", 0.7)} />
          <stop offset="100%" stopColor={alpha("#000000", 0.25)} />
        </linearGradient>
      </defs>
      <path d="M 40 462 L 680 462" stroke={alpha("#000000", 0.12)} strokeWidth={16} strokeLinecap="round" />
      {[128, 596].map((x) => (
        <g key={x}>
          <polygon
            points={`${x - 22},452 ${x + 22},452 ${x + 14},426 ${x - 14},426`}
            fill={alpha("#ffffff", 0.35)}
          />
          <rect x={x - 26} y={450} width={52} height={12} rx={4} fill={alpha("#000000", 0.22)} />
        </g>
      ))}
      <path d={path} fill="none" stroke={alpha("#000000", 0.28)} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke={`url(#${id("pipe")})`} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={path}
        fill="none"
        stroke={alpha("#ffffff", 0.6)}
        strokeWidth={6}
        strokeLinecap="round"
        transform="translate(0 -6)"
      />
      <path
        d={path}
        fill="none"
        stroke={design.accent}
        strokeWidth={11}
        strokeLinecap="round"
        strokeDasharray="18 22"
        strokeDashoffset={-p * 168}
        opacity={0.55 + p * 0.45}
      />
      <rect x={316} y={188} width={40} height={40} rx={7} fill={design.accent2} />
      <rect x={332} y={148} width={9} height={42} fill={alpha("#ffffff", 0.7)} />
      <circle cx={336} cy={140} r={26} fill="none" stroke={design.accent2} strokeWidth={9} />
      <circle cx={336} cy={140} r={7} fill={design.accent2} />
      {[0, 45, 90, 135].map((deg) => (
        <line
          key={deg}
          x1={336 - 22 * Math.cos((deg * Math.PI) / 180)}
          y1={140 - 22 * Math.sin((deg * Math.PI) / 180)}
          x2={336 + 22 * Math.cos((deg * Math.PI) / 180)}
          y2={140 + 22 * Math.sin((deg * Math.PI) / 180)}
          stroke={design.accent2}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ))}
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* chart                                                              */
/* ------------------------------------------------------------------ */
export const Chart: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);
  const factors = [0.42, 0.6, 0.5, 0.82, 1];
  const heights = factors.map((f) => 34 + p * 300 * f);

  return (
    <svg {...frame(scale)}>
      <line x1={96} y1={470} x2={668} y2={470} stroke={alpha("#ffffff", 0.42)} strokeWidth={5} strokeLinecap="round" />
      <line x1={96} y1={470} x2={96} y2={132} stroke={alpha("#ffffff", 0.42)} strokeWidth={5} strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={96}
          y1={386 - i * 84}
          x2={668}
          y2={386 - i * 84}
          stroke={alpha("#ffffff", 0.14)}
          strokeWidth={3}
          strokeDasharray="10 12"
        />
      ))}
      {heights.map((height, i) => {
        const x = 138 + i * 108;
        return (
          <g key={i}>
            <rect
              x={x}
              y={470 - height}
              width={64}
              height={height}
              rx={10}
              fill={i % 2 === 0 ? design.accent : design.accent2}
              opacity={0.92}
            />
            <rect
              x={x + 10}
              y={470 - height + 10}
              width={12}
              height={Math.max(0, height - 20)}
              rx={6}
              fill={alpha("#ffffff", 0.34)}
            />
            <rect x={x - 8} y={462} width={80} height={14} rx={7} fill={alpha("#000000", 0.22)} />
          </g>
        );
      })}
      <path
        d="M 170 424 L 278 390 L 386 404 L 494 322 L 602 152"
        fill="none"
        stroke="#ffd21c"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4 + p * 0.6}
      />
      <path
        d="M 578 152 L 602 152 L 602 176"
        fill="none"
        stroke="#ffd21c"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4 + p * 0.6}
      />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* phone                                                              */
/* ------------------------------------------------------------------ */
export const Phone: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={530} rx={170} ry={14} fill={alpha("#000000", 0.18)} />
      <rect x={206} y={56} width={308} height={468} rx={38} fill="#1b2026" />
      <rect x={206} y={56} width={308} height={468} rx={38} fill="none" stroke={alpha("#ffffff", 0.28)} strokeWidth={4} />
      <rect x={224} y={84} width={272} height={412} rx={20} fill={design.bgTo} />
      <rect x={316} y={66} width={88} height={12} rx={6} fill="#1b2026" />
      <rect x={224} y={84} width={272} height={64} rx={20} fill={design.accent} />
      <rect x={224} y={130} width={272} height={18} fill={design.accent} />
      <circle cx={256} cy={116} r={15} fill={alpha("#ffffff", 0.85)} />
      <rect x={282} y={106} width={112} height={10} rx={5} fill={alpha("#ffffff", 0.8)} />
      <rect x={282} y={124} width={74} height={8} rx={4} fill={alpha("#ffffff", 0.5)} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={244}
            y={172 + i * 66}
            width={232}
            height={52}
            rx={12}
            fill={alpha(design.text, 0.13)}
          />
          <circle cx={270} cy={198 + i * 66} r={13} fill={i % 2 ? design.accent2 : design.accent} opacity={0.85} />
          <rect x={294} y={188 + i * 66} width={148} height={9} rx={4} fill={alpha(design.text, 0.4)} />
          <rect x={294} y={204 + i * 66} width={98} height={8} rx={4} fill={alpha(design.text, 0.24)} />
        </g>
      ))}
      <rect x={244} y={444} width={232} height={14} rx={7} fill={alpha(design.text, 0.18)} />
      <rect x={244} y={444} width={232 * p} height={14} rx={7} fill={design.accent} />
      <rect x={312} y={500} width={96} height={9} rx={5} fill={alpha("#ffffff", 0.45)} />
      <Tag text={label} y={40} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* person                                                             */
/* ------------------------------------------------------------------ */
export const Person: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);
  const wave = -p * 52;

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={512} rx={190} ry={16} fill={alpha("#000000", 0.16)} />
      <circle cx={360} cy={178} r={66} fill="#f0c9a0" />
      <path d="M 294 168 Q 300 100 360 100 Q 420 100 426 168 Q 392 132 360 138 Q 328 132 294 168 Z" fill="#2b2420" />
      <circle cx={336} cy={180} r={6} fill="#2b2420" />
      <circle cx={384} cy={180} r={6} fill="#2b2420" />
      <path d="M 338 208 Q 360 224 382 208" fill="none" stroke="#a9603c" strokeWidth={6} strokeLinecap="round" />
      <path
        d="M 268 330 Q 268 254 360 254 Q 452 254 452 330 L 452 410 L 268 410 Z"
        fill={design.accent}
      />
      <path d="M 268 330 Q 268 254 360 254 L 360 410 L 268 410 Z" fill={alpha("#ffffff", 0.16)} />
      <g transform={`rotate(${wave} 452 306)`}>
        <path
          d="M 452 306 L 556 268"
          stroke="#f0c9a0"
          strokeWidth={26}
          strokeLinecap="round"
        />
        <circle cx={562} cy={264} r={17} fill="#f0c9a0" />
      </g>
      <path d="M 268 306 L 196 348" stroke="#f0c9a0" strokeWidth={26} strokeLinecap="round" />
      <circle cx={190} cy={352} r={17} fill="#f0c9a0" />
      <rect x={286} y={404} width={56} height={102} rx={20} fill={design.accent2} />
      <rect x={378} y={404} width={56} height={102} rx={20} fill={design.accent2} />
      <rect x={272} y={498} width={84} height={22} rx={11} fill="#20262b" />
      <rect x={364} y={498} width={84} height={22} rx={11} fill="#20262b" />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* house                                                              */
/* ------------------------------------------------------------------ */
export const House: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={486} rx={264} ry={16} fill={alpha("#000000", 0.16)} />
      <circle cx={594} cy={156} r={50} fill={alpha(design.accent, 0.28)} />
      <circle cx={594} cy={156} r={32} fill={design.accent} />
      <rect x={466} y={128} width={52} height={112} rx={5} fill={alpha("#000000", 0.24)} />
      <g fill={alpha("#ffffff", 0.4)}>
        <circle cx={492} cy={112 - p * 22} r={18} />
        <circle cx={506} cy={82 - p * 28} r={13} opacity={0.7} />
      </g>
      <rect x={168} y={258} width={384} height={228} rx={8} fill={alpha("#ffffff", 0.46)} stroke={alpha("#ffffff", 0.6)} strokeWidth={3} />
      <path d="M 132 262 L 360 106 L 588 262 Z" fill={design.accent2} />
      <path d="M 132 262 L 360 106 L 360 142 L 168 262 Z" fill={alpha("#ffffff", 0.22)} />
      <rect x={318} y={364} width={84} height={122} rx={6} fill={alpha("#000000", 0.3)} />
      <circle cx={386} cy={426} r={6} fill="#ffd21c" />
      {[228, 464].map((x) => (
        <g key={x}>
          <rect x={x} y={310} width={76} height={76} rx={8} fill={alpha("#000000", 0.28)} />
          <rect
            x={x + 8}
            y={318}
            width={60}
            height={60}
            rx={5}
            fill={alpha("#ffd21c", 0.22 + p * 0.66)}
          />
          <line x1={x + 38} y1={318} x2={x + 38} y2={378} stroke={alpha("#ffffff", 0.5)} strokeWidth={4} />
          <line x1={x + 8} y1={348} x2={x + 68} y2={348} stroke={alpha("#ffffff", 0.5)} strokeWidth={4} />
        </g>
      ))}
      <rect x={132} y={482} width={456} height={14} rx={7} fill={alpha("#000000", 0.24)} />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* mountain                                                           */
/* ------------------------------------------------------------------ */
export const Mountain: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);
  const sunY = 158 - p * 74;

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={498} rx={300} ry={16} fill={alpha("#000000", 0.14)} />
      <circle cx={534} cy={sunY} r={58} fill={alpha(design.accent, 0.26)} />
      <circle cx={534} cy={sunY} r={38} fill={design.accent} />
      <path d="M 44 466 L 244 176 L 444 466 Z" fill={alpha("#000000", 0.24)} />
      <path d="M 244 176 L 168 296 L 214 276 L 248 316 L 288 268 L 330 296 Z" fill={alpha("#ffffff", 0.7)} />
      <path d="M 268 466 L 452 208 L 660 466 Z" fill={alpha("#ffffff", 0.38)} />
      <path d="M 452 208 L 382 308 L 424 290 L 458 326 L 496 288 L 536 310 Z" fill={alpha("#ffffff", 0.86)} />
      <rect x={452} y={138} width={6} height={76} fill={alpha("#ffffff", 0.8)} />
      <path d="M 458 140 L 518 156 L 458 176 Z" fill={design.accent2} />
      <path d="M 44 466 Q 180 432 316 466 T 660 466 L 660 512 L 44 512 Z" fill={alpha(design.accent2, 0.42)} />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* lab                                                                */
/* ------------------------------------------------------------------ */
export const Lab: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const level = 426 - p * 220;

  return (
    <svg {...frame(scale)}>
      <defs>
        <linearGradient id={id("fluid")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={design.accent} />
          <stop offset="100%" stopColor={design.accent2} />
        </linearGradient>
        <clipPath id={id("flask")}>
          <path d="M 320 150 L 400 150 L 400 262 L 480 424 L 240 424 L 320 262 Z" />
        </clipPath>
      </defs>
      <ellipse cx={360} cy={480} rx={190} ry={14} fill={alpha("#000000", 0.16)} />
      <rect x={236} y={458} width={248} height={18} rx={9} fill={alpha("#000000", 0.26)} />
      <path
        d="M 320 150 L 400 150 L 400 262 L 480 424 L 240 424 L 320 262 Z"
        fill={alpha("#ffffff", 0.16)}
        stroke={alpha("#ffffff", 0.58)}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${id("flask")})`}>
        <rect x={240} y={level} width={240} height={446 - level} fill={`url(#${id("fluid")})`} />
        <ellipse cx={360} cy={level} rx={120} ry={16} fill={alpha("#ffffff", 0.24)} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 272 + ((i * 67) % 178);
          const y = level + 28 + ((i * 43) % Math.max(40, 420 - level));
          return <circle key={i} cx={x} cy={y} r={5 + (i % 3) * 3} fill={alpha("#ffffff", 0.6)} />;
        })}
      </g>
      <path d="M 324 158 L 324 258 L 268 382" fill="none" stroke={alpha("#ffffff", 0.5)} strokeWidth={8} strokeLinecap="round" />
      <rect x={312} y={118} width={96} height={34} rx={8} fill={design.accent2} />
      <rect x={312} y={118} width={96} height={12} rx={6} fill={alpha("#ffffff", 0.35)} />
      <rect x={492} y={318} width={104} height={148} rx={14} fill={alpha("#ffffff", 0.16)} stroke={alpha("#ffffff", 0.5)} strokeWidth={4} />
      <rect x={498} y={466 - p * 100} width={92} height={100} rx={10} fill={design.accent} opacity={0.82} />
      <rect x={518} y={288} width={52} height={32} rx={6} fill={design.accent2} />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* money                                                              */
/* ------------------------------------------------------------------ */
export const Money: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);
  const count = 3 + Math.round(p * 5);
  const stacks = [
    { x: 196, w: 150 },
    { x: 372, w: 170 },
    { x: 548, w: 132 },
  ];

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={490} rx={282} ry={16} fill={alpha("#000000", 0.16)} />
      {stacks.map((stack, si) => (
        <g key={stack.x}>
          {Array.from({ length: count - (si === 2 ? 1 : 0) }).map((_, i) => {
            const y = 462 - i * 26;
            return (
              <g key={i}>
                <rect
                  x={stack.x - stack.w / 2}
                  y={y}
                  width={stack.w}
                  height={20}
                  rx={10}
                  fill={alpha(design.accent2, 0.9)}
                />
                <ellipse
                  cx={stack.x}
                  cy={y}
                  rx={stack.w / 2}
                  ry={16}
                  fill={design.accent}
                  stroke={alpha("#ffffff", 0.55)}
                  strokeWidth={3}
                />
                <ellipse
                  cx={stack.x}
                  cy={y}
                  rx={stack.w / 2 - 14}
                  ry={9}
                  fill="none"
                  stroke={alpha("#ffffff", 0.4)}
                  strokeWidth={3}
                />
              </g>
            );
          })}
        </g>
      ))}
      <g transform="translate(360 168) rotate(-12)">
        <circle r={88} fill={alpha(design.accent, 0.24)} />
        <circle r={72} fill={design.accent} stroke={alpha("#ffffff", 0.7)} strokeWidth={6} />
        <circle r={56} fill="none" stroke={alpha("#ffffff", 0.5)} strokeWidth={4} />
        <text
          x={0}
          y={24}
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={72}
          fontWeight={800}
          fill="#ffffff"
        >
          $
        </text>
      </g>
      <Tag text={label} y={44} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* food                                                               */
/* ------------------------------------------------------------------ */
export const Food: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={494} rx={268} ry={18} fill={alpha("#000000", 0.16)} />
      <ellipse cx={360} cy={470} rx={252} ry={34} fill={alpha("#ffffff", 0.46)} stroke={alpha("#ffffff", 0.6)} strokeWidth={4} />
      <g fill="none" stroke={alpha("#ffffff", 0.55)} strokeWidth={7} strokeLinecap="round" opacity={0.28 + p * 0.5}>
        <path d="M 292 214 q -26 -34 0 -68 q 26 -34 0 -68" />
        <path d="M 360 200 q -26 -34 0 -68 q 26 -34 0 -68" />
        <path d="M 428 214 q -26 -34 0 -68 q 26 -34 0 -68" />
      </g>
      <path
        d="M 166 316 Q 180 452 360 456 Q 540 452 554 316 Z"
        fill={design.accent2}
      />
      <path d="M 186 336 Q 220 432 360 438 Q 500 432 534 336 Z" fill={alpha("#000000", 0.14)} />
      <ellipse
        cx={360}
        cy={322 - p * 22}
        rx={182 - p * 12}
        ry={34}
        fill={design.accent}
        stroke={alpha("#ffffff", 0.5)}
        strokeWidth={4}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={270 + i * 46}
          cy={316 - p * 22 + (i % 2) * 8}
          r={12}
          fill={alpha("#ffffff", 0.42)}
        />
      ))}
      <ellipse cx={360} cy={316} rx={194} ry={40} fill="none" stroke={alpha("#ffffff", 0.72)} strokeWidth={8} />
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* network                                                            */
/* ------------------------------------------------------------------ */
export const Network: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const p = clamp01(progress);
  const active = 1 + Math.floor(p * 5.99);
  const nodes = [
    { x: 360, y: 292, r: 54 },
    { x: 158, y: 170, r: 30 },
    { x: 566, y: 158, r: 30 },
    { x: 132, y: 402, r: 28 },
    { x: 588, y: 400, r: 28 },
    { x: 360, y: 486, r: 32 },
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 2],
  ];

  return (
    <svg {...frame(scale)}>
      <ellipse cx={360} cy={512} rx={220} ry={14} fill={alpha("#000000", 0.12)} />
      {edges.map(([from, to], i) => (
        <line
          key={i}
          x1={nodes[from].x}
          y1={nodes[from].y}
          x2={nodes[to].x}
          y2={nodes[to].y}
          stroke={i < active ? design.accent : alpha("#ffffff", 0.22)}
          strokeWidth={i < active ? 8 : 5}
          strokeLinecap="round"
          opacity={i < active ? 0.85 : 0.6}
        />
      ))}
      {nodes.map((node, i) => {
        const on = i <= active;
        const r = i === 0 ? node.r * (1 + p * 0.1) : node.r;
        return (
          <g key={i}>
            <circle cx={node.x} cy={node.y} r={r + 12} fill={alpha(i % 2 ? design.accent2 : design.accent, on ? 0.24 : 0.08)} />
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill={on ? (i % 2 ? design.accent2 : design.accent) : alpha("#ffffff", 0.24)}
              stroke={alpha("#ffffff", 0.7)}
              strokeWidth={4}
            />
            <circle cx={node.x - r * 0.28} cy={node.y - r * 0.3} r={r * 0.22} fill={alpha("#ffffff", 0.5)} />
          </g>
        );
      })}
      <Tag text={label} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* finale                                                             */
/* ------------------------------------------------------------------ */
export const Finale: React.FC<ObjectProps> = ({
  design,
  progress,
  label,
  scale = 1,
}) => {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const p = clamp01(progress);
  const rotate = (p * 30).toFixed(2);
  const radius = 150 + p * 14;

  return (
    <svg {...frame(scale)}>
      <defs>
        <radialGradient id={id("burst")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={alpha(design.accent, 0.5)} />
          <stop offset="100%" stopColor={alpha(design.accent, 0)} />
        </radialGradient>
      </defs>
      <circle cx={360} cy={288} r={radius + 60} fill={`url(#${id("burst")})`} />
      <g transform={`rotate(${rotate} 360 288)`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x={354}
            y={288 - radius - 64}
            width={12}
            height={58}
            rx={6}
            fill={i % 2 ? design.accent2 : design.accent}
            opacity={0.55 + p * 0.45}
            transform={`rotate(${i * 30} 360 288)`}
          />
        ))}
      </g>
      <circle cx={360} cy={288} r={radius} fill={design.accent} stroke={alpha("#ffffff", 0.8)} strokeWidth={7} />
      <circle cx={360} cy={288} r={radius - 22} fill="none" stroke={alpha("#ffffff", 0.4)} strokeWidth={4} />
      <path
        d="M 296 292 L 342 338 L 430 244"
        fill="none"
        stroke="#ffffff"
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4 + p * 0.6}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} opacity={0.3 + p * 0.7}>
          <circle
            cx={132 + ((i * 173) % 456)}
            cy={104 + ((i * 97) % 372)}
            r={7 + (i % 3) * 4}
            fill={i % 2 ? design.accent2 : "#ffd21c"}
          />
        </g>
      ))}
      <Tag text={label} y={44} />
    </svg>
  );
};

export const OBJECT_COMPONENTS: Record<VisualKind, React.FC<ObjectProps>> = {
  vehicle: Vehicle,
  container: Container,
  factory: Factory,
  ship: Ship,
  globe: Globe,
  pipeline: Pipeline,
  chart: Chart,
  phone: Phone,
  person: Person,
  house: House,
  mountain: Mountain,
  lab: Lab,
  money: Money,
  food: Food,
  network: Network,
  finale: Finale,
};
