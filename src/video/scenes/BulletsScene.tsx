import React from "react";
import { FPS } from "../../lib/plan/schema";
import { fadeUp, springIn } from "../anim";
import { displayLineHeight, displayWeight } from "../design";
import { WRAP, fitSize } from "../typography";
import { AccentRule, Kicker, SceneShell } from "./shell";
import type { SceneProps } from "./types";

const bulletSize = (text: string): number =>
  fitSize(
    text,
    [
      { minLength: 60, size: 38 },
      { minLength: 46, size: 42 },
      { minLength: 32, size: 46 },
    ],
    50,
  );

const headSize = (text: string): number =>
  fitSize(
    text,
    [
      { minLength: 60, size: 60 },
      { minLength: 40, size: 68 },
    ],
    78,
  );

export const BulletsScene: React.FC<SceneProps> = ({ scene, design, frame }) => {
  const heading = scene.heading ?? "";
  const kicker = scene.label ?? "";
  const bullets = scene.bullets ?? [];

  const intro = frame + 4;
  const rule = springIn(intro, FPS, 0);
  const head = fadeUp(intro, FPS, 2, 28);

  if (!heading && bullets.length === 0) return null;

  return (
    <SceneShell design={design} justify="center">
      {kicker ? <Kicker design={design} opacity={rule.opacity}>{kicker}</Kicker> : null}

      {heading ? (
        <h2
          style={{
            margin: 0,
            marginBottom: 26,
            maxWidth: 880,
            fontFamily: design.display,
            fontSize: headSize(heading),
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
      ) : null}

      <AccentRule
        design={design}
        progress={rule.scale}
        width={92}
        height={6}
        marginBottom={30}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
        {bullets.map((bullet, index) => {
          const delay = 6 + index * 7;
          const item = fadeUp(intro, FPS, delay, 30);
          const badge = springIn(intro, FPS, delay);
          const size = bulletSize(bullet);

          return (
            <div
              key={`${index}-${bullet}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "24px 26px",
                background: design.card,
                border: `1.5px solid ${design.cardBorder}`,
                borderLeft: `5px solid ${design.accent}`,
                borderRadius: design.radius,
                boxShadow: design.lightSurface
                  ? "0 18px 40px rgba(20,18,15,0.10)"
                  : "0 22px 50px rgba(0,0,0,0.35)",
                ...item,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 62,
                  height: 62,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 999,
                  background: design.accent,
                  color: design.lightSurface ? "#FFF8EF" : "#08070C",
                  fontFamily: design.body,
                  fontSize: 28,
                  fontWeight: 800,
                  transform: `scale(${badge.scale})`,
                  opacity: badge.opacity,
                }}
              >
                {index + 1}
              </div>
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontFamily: design.body,
                  fontSize: size,
                  lineHeight: 1.24,
                  fontWeight: 600,
                  color: design.text,
                  ...WRAP,
                }}
              >
                {bullet}
              </div>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};

export default BulletsScene;
