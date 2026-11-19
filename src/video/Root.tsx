import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../lib/plan/schema";
import { totalFramesFor } from "../lib/plan/timing";
import { ShortVideo } from "./ShortVideo";
import { SAMPLE_PLAN } from "./sample-plan";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ShortVideo"
      component={ShortVideo}
      durationInFrames={totalFramesFor(SAMPLE_PLAN)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ plan: SAMPLE_PLAN }}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFramesFor(props.plan),
        fps: FPS,
        width: WIDTH,
        height: HEIGHT,
      })}
    />
  );
};
