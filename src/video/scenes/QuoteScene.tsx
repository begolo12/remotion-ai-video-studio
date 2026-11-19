import React from "react";
import { FPS } from "../../lib/plan/schema";
import { fadeUp, springIn } from "../anim";
import { alpha, displayLineHeight, displayWeight } from "../design";
import { WRAP, fitSize } from "../typography";
import { SceneShell } from "./shell";
import type { SceneProps } from "./types";

const quoteSize = (text: string): number =>
  fitSize(
    text,
    [
      { minLength: 170, size: 48 },
      { minLength: 130, size: 54 },
      { minLength: 90, size: 60 },
    ],
    68,
  );

export const QuoteScene: React.FC<SceneProps> = ({ scene, design, frame }) => {
  const quote = scene.quote ?? scene.text ?? scene.heading ?? "";
  const author = scene.author ?? scene.label ?? "";

  const intro = frame + 3;
  const card = springIn(intro, FPS, 0);
  const mark = springIn(intro, FPS, 3);
  const body = fadeUp(intro, FPS, 6, 26);
  const authorIn = fadeUp(intro, FPS, 14, 18);

  if (!quote) return null;

  return (
    <SceneShell design={design}>
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "46px 44px 44px",
          background: design.card,
          border: `1.5px solid ${design.cardBorder}`,
          borderRadius: design.radius + 8,
          boxShadow: design.lightSurface
            ? "0 24px 60px rgba(20,18,15,0.12)"
            : "0 28px 70px rgba(0,0,0,0.4)",
          transform: `scale(${0.985 + 0.015 * card.scale})`,
          opacity: card.opacity,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: `linear-gradient(180deg, ${design.accent}, ${design.accent2})`,
          }}
        />

        <div
          style={{
            position: "absolute",
            right: -60,
            top: -40,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(design.accent, 0.18)} 0%, transparent 70%)`,
          }}
        />

        <div
          style={{
            fontFamily: design.display,
            fontSize: 128,
            lineHeight: 0.8,
            height: 76,
            color: design.accent,
            transform: `scale(${mark.scale})`,
            transformOrigin: "left top",
            opacity: mark.opacity,
          }}
        >
          &ldquo;
        </div>

        <blockquote
          style={{
            margin: 0,
            fontFamily: design.display,
            fontSize: quoteSize(quote),
            fontWeight: displayWeight(design),
            lineHeight: displayLineHeight(design) + 0.16,
            letterSpacing: design.tracking,
            color: design.text,
            ...WRAP,
            ...body,
          }}
        >
          {quote}
        </blockquote>

        {author ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 30,
              ...authorIn,
            }}
          >
            <span
              style={{
                width: 40,
                height: 3,
                borderRadius: 999,
                background: design.accent,
              }}
            />
            <span
              style={{
                fontFamily: design.body,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: design.textMuted,
                ...WRAP,
              }}
            >
              {author}
            </span>
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};

export default QuoteScene;
