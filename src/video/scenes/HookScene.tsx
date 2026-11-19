import React from "react";
import { FPS } from "../../lib/plan/schema";
import { fadeUp, revealWords, springIn } from "../anim";
import { displayLineHeight, displayWeight } from "../design";
import { WRAP, fitSize } from "../typography";
import { AccentRule, Kicker, SceneShell } from "./shell";
import type { SceneProps } from "./types";

const headingSize = (text: string): number =>
  fitSize(
    text,
    [
      { minLength: 84, size: 72 },
      { minLength: 68, size: 82 },
      { minLength: 52, size: 94 },
      { minLength: 34, size: 108 },
    ],
    124,
  );

export const HookScene: React.FC<SceneProps> = ({ scene, design, frame }) => {
  const heading = scene.heading ?? scene.text ?? "";
  const subheading = scene.subheading ?? "";
  const kicker = scene.label ?? "";

  // Scene pembuka harus terbaca penuh di frame 0 (thumbnail), jadi animasi
  // dimajukan beberapa frame alih-alih mulai dari kosong.
  const intro = frame + 7;
  const head = revealWords(heading, intro, FPS, 0, 3);
  const rule = springIn(intro, FPS, 0);
  const sub = fadeUp(intro, FPS, 6 + head.length * 3, 26);

  if (!heading && !subheading) return null;

  return (
    <SceneShell design={design}>
      {kicker ? <Kicker design={design} opacity={rule.opacity}>{kicker}</Kicker> : null}

      <h1
        style={{
          margin: 0,
          maxWidth: 900,
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
              marginRight: "0.24em",
              opacity: word.opacity,
              transform: `translateY(${word.translateY}px) scale(${word.scale})`,
              transformOrigin: "left bottom",
            }}
          >
            {word.text}
          </span>
        ))}
      </h1>

      <AccentRule design={design} progress={rule.scale} marginTop={34} marginBottom={30} />

      {subheading ? (
        <p
          style={{
            margin: 0,
            maxWidth: 780,
            fontFamily: design.body,
            fontSize: 44,
            lineHeight: 1.3,
            fontWeight: 500,
            color: design.textMuted,
            ...WRAP,
            ...sub,
          }}
        >
          {subheading}
        </p>
      ) : null}
    </SceneShell>
  );
};

export default HookScene;
