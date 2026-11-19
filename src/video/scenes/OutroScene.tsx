import React from "react";
import { FPS } from "../../lib/plan/schema";
import { fadeUp, springIn } from "../anim";
import { alpha, displayLineHeight, displayWeight, readableOn } from "../design";
import { WRAP, fitSize } from "../typography";
import { SceneShell } from "./shell";
import type { SceneProps } from "./types";

const headingSize = (text: string): number =>
  fitSize(
    text,
    [
      { minLength: 70, size: 66 },
      { minLength: 56, size: 74 },
      { minLength: 36, size: 86 },
    ],
    98,
  );

export const OutroScene: React.FC<SceneProps> = ({ scene, design, frame, isLast }) => {
  const heading = scene.heading ?? "";
  const cta = scene.text ?? scene.subheading ?? "";
  const kicker = scene.label ?? "";

  const intro = frame + 3;
  const ring = springIn(intro, FPS, 0);
  const head = fadeUp(intro, FPS, 2, 30);
  const pill = springIn(intro, FPS, 9);
  const note = fadeUp(intro, FPS, 16, 16);

  if (!heading && !cta) return null;

  const shine = ((frame * 5) % 260) - 60;

  return (
    <SceneShell design={design} align="center" textAlign="center">
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          border: `1.5px solid ${alpha(design.accent, 0.2)}`,
          transform: `scale(${0.94 + 0.06 * ring.scale})`,
          opacity: ring.opacity * 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(design.accent, 0.16)} 0%, transparent 68%)`,
          opacity: ring.opacity,
        }}
      />

      {kicker ? (
        <div
          style={{
            marginBottom: 22,
            fontFamily: design.body,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: design.accent,
            opacity: head.opacity,
          }}
        >
          {kicker}
        </div>
      ) : null}

      <h2
        style={{
          margin: 0,
          maxWidth: 820,
          fontFamily: design.display,
          fontSize: headingSize(heading),
          fontWeight: displayWeight(design),
          lineHeight: displayLineHeight(design),
          letterSpacing: design.tracking,
          textTransform: design.uppercase ? "uppercase" : "none",
          color: design.text,
          ...WRAP,
          ...head,
        }}
      >
        {heading}
      </h2>

      {cta ? (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            marginTop: 42,
            padding: "26px 46px",
            borderRadius: 999,
            background: design.accent,
            color: readableOn(design.accent),
            fontFamily: design.body,
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: design.uppercase ? "0.03em" : "0",
            textTransform: design.uppercase ? "uppercase" : "none",
            maxWidth: 820,
            ...WRAP,
            transform: `scale(${pill.scale})`,
            opacity: pill.opacity,
            boxShadow: `0 24px 60px ${alpha(design.accent, 0.35)}`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              bottom: -40,
              left: shine,
              width: 70,
              transform: "rotate(18deg)",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
            }}
          />
          <span style={{ position: "relative" }}>{cta}</span>
        </div>
      ) : null}

      {isLast ? (
        <p
          style={{
            margin: 0,
            marginTop: 34,
            fontFamily: design.body,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: design.textMuted,
            ...note,
          }}
        >
          Follow untuk part berikutnya
        </p>
      ) : null}
    </SceneShell>
  );
};

export default OutroScene;
