import type { Scene, StyleId } from "../../lib/plan/schema";
import type { Design } from "../design";

export type SceneProps = {
  scene: Scene;
  design: Design;
  styleId: StyleId;
  /** Frame relatif di dalam scene ini (0 = frame pertama scene). */
  frame: number;
  durationInFrames: number;
  /** true bila scene ini adalah penutup (outro). */
  isLast: boolean;
  /** Urutan scene, dipakai untuk variasi arah kamera. */
  index: number;
};

export type SceneComponent = React.FC<SceneProps>;
