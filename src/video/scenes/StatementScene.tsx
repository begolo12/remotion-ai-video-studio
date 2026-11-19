import React from "react";
import { FPS } from "../../lib/plan/schema";
import { fadeUp, revealWords, springIn } from "../anim";
import { alpha, displayLineHeight, displayWeight } from "../design";
import { WRAP, fitSize } from "../typography";
import { Kicker, SceneShell } from "./shell";
import type { SceneProps } from "./types";

const headingSize = (text: string): number =>
  fitSize(
    text,
    [
      { minLength: 78, size: 64 },
      { minLength: 60, size: 72 },
      { minLength: 42, size: 82 },
    ],
    94,
  );

export const StatementScene: React.FC<SceneProps> = ({ scene, design, frame }) => {
  const heading = scene.heading ?? "";
  const text = scene.text ?? scene.subheading ?? "";
  const kicker = scene.label ?? "";

  const intro = frame + 4;
  const line = springIn(intro, FPS, 0);
  const head = revealWords(heading, intro, FPS, 2, 2);
  const body = fadeUp(intro, FPS, 10 + head.length * 2, 24);

  if (!heading && !text) return null;

  return (
    <SceneShell design={design}>
      <div
        style={{
          position: "absolute",
          right: -180,
          top: 240,
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: `1.5px solid ${alpha(design.accent, 0.22)}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -90,
          top: 330,
          width: 440,
          height: 440,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(design.accent2, 0.16)} 0%, transparent 68%)`,
        }}
      />

      <div style={{ display: "flex", gap: 34, alignItems: "flex-start", width: "100%" }}>
        <div
          style={{
            flexShrink: 0,
            width: 8,
            height: 320,
            marginTop: 6,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${design.accent}, ${design.accent2})`,
            transform: `scaleY(${line.scale})`,
            transformOrigin: "top center",
            opacity: line.opacity,
          }}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          {kicker ? <Kicker design={design} opacity={line.opacity}>{kicker}</Kicker> : null}

          <h2
            style={{
              margin: 0,
              maxWidth: 780,
              fontFamily: design.display,
              fontSize: headingSize(heading),
              fontWeight: displayWeight(design),
              lineHeight: displayLineHeight(design),
              letterSpacing: design.tracking,
              textTransform: design.uppercase ? "uppercase" : "none",
              color: design.text,
              ...WRAP,
            }}
          >
            {head.map((word, index) => (
              <span
                key={`${word.text}-${index}`}
                style={{
                  display: "inline-block",
                  marginRight: "0.22em",
                  opacity: word.opacity,
                  transform: `translateY(${word.translateY}px)`,
                  transformOrigin: "left bottom",
                }}
              >
                {word.text}
              </span>
            ))}
          </h2>

          {text ? (
            <p
              style={{
                margin: 0,
                marginTop: 30,
                maxWidth: 740,
                fontFamily: design.body,
                fontSize: 42,
                lineHeight: 1.4,
                fontWeight: 400,
                color: design.textMuted,
                ...WRAP,
                ...body,
              }}
            >
              {text}
            </p>
          ) : null}
        </div>
      </div>
    </SceneShell>
  );
};

export default StatementScene;
