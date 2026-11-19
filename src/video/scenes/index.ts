import type { SceneTemplate } from "../../lib/plan/schema";
import { BulletsScene } from "./BulletsScene";
import { HookScene } from "./HookScene";
import { OutroScene } from "./OutroScene";
import { QuoteScene } from "./QuoteScene";
import { StatScene } from "./StatScene";
import { StatementScene } from "./StatementScene";
import type { SceneComponent } from "./types";

/** Peta template → komponen scene yang dipakai ShortVideo. */
export const SCENE_COMPONENTS: Record<SceneTemplate, SceneComponent> = {
  hook: HookScene,
  bullets: BulletsScene,
  stat: StatScene,
  quote: QuoteScene,
  statement: StatementScene,
  outro: OutroScene,
};
