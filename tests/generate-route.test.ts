import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanV2 } from "@/lib/plan/v2";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

const makePlan = (): PlanV2 => ({
  schemaVersion: 2,
  id: PROJECT_ID,
  title: "Uji Otomatis",
  prompt: "Video tentang cara fokus bekerja",
  language: "id",
  audience: "umum",
  tone: "edukatif",
  targetPlatform: "youtube-shorts",
  targetSeconds: 30,
  styleId: "minimal",
  styleBible: {
    palette: ["#000000", "#ffffff"],
    typography: "sans",
    captionStyle: "putih",
    backgroundStyle: "polos",
    cameraLanguage: "push-in",
    transitionLanguage: "fade",
    visualDensity: "medium",
    lighting: "netral",
    texture: "halus",
    prohibitedPatterns: [],
  },
  hook: "Hook uji",
  keyMessage: "Pesan uji",
  scenes: [
    {
      id: "scene-1",
      order: 1,
      type: "hook",
      purpose: "menarik perhatian",
      visual: "person",
      durationSeconds: 5,
      heading: "Halo",
      narration: "Halo",
      caption: "Halo",
      visualDirection: "orang",
      camera: "push-in",
      transitionIn: "fade",
      assetBrief: {
        subject: "orang",
        composition: "tengah",
        lighting: "netral",
        mood: "tenang",
        aspectRatio: "9:16",
      },
      assetRefs: [],
      weight: 1,
    },
  ],
  outro: { heading: "Selesai", cta: "Simpan" },
  publishing: {
    title: "Uji",
    description: "Caption uji",
    hashtags: ["#shorts"],
    pinnedComment: "",
    thumbnailText: "Uji",
  },
  quality: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
  generateStoryboard: vi.fn(),
  attachCloudNarration: vi.fn(),
  installAiRunLogger: vi.fn(),
  createProjectWithPlan: vi.fn(),
}));

vi.mock("@/lib/auth/access", () => ({
  requireUser: mocks.requireUser,
  ensurePersonalWorkspace: mocks.ensurePersonalWorkspace,
  AccessError: class AccessError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/ai/pipeline", () => ({
  generateStoryboard: mocks.generateStoryboard,
}));

vi.mock("@/lib/audio/tts-cloud", () => ({
  attachCloudNarration: mocks.attachCloudNarration,
  TTS_VOICES: { male: "id-ID-ArdiNeural", female: "id-ID-GadisNeural" },
}));

vi.mock("@/lib/integrations/ai-logger", () => ({
  installAiRunLogger: mocks.installAiRunLogger,
}));

vi.mock("@/lib/projects/service", () => ({
  createProjectWithPlan: mocks.createProjectWithPlan,
}));

const makeRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validInput = {
  description: "Video tentang cara fokus bekerja",
  targetSeconds: 30,
  styleId: "minimal",
  withNarration: false,
};

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: USER_ID });
    mocks.ensurePersonalWorkspace.mockResolvedValue({ id: WORKSPACE_ID });
    mocks.generateStoryboard.mockResolvedValue(makePlan());
    mocks.installAiRunLogger.mockImplementation(() => undefined);
    mocks.attachCloudNarration.mockImplementation(async (plan: unknown) => ({ plan, result: {} }));
    mocks.createProjectWithPlan.mockImplementation(async (input: { planV2: PlanV2; model: string }) => ({
      id: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      title: input.planV2.title,
      status: "ready",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      planV2: input.planV2,
      plan: {
        version: 1,
        title: input.planV2.title,
        hook: input.planV2.hook,
        styleId: input.planV2.styleId,
        targetSeconds: 30,
        scenes: [],
        outro: input.planV2.outro,
        caption: "Caption uji",
        hashtags: [],
      },
      model: input.model,
      revisionId: "revision-1",
      revisionNumber: 1,
    }));
  });

  it("membuat project dari storyboard yang valid", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const response = await POST(makeRequest(validInput));
    const payload = (await response.json()) as { project: { id: string }; model: string };

    expect(response.status).toBe(200);
    expect(payload.project.id).toBe(PROJECT_ID);
    expect(payload.model).toBe("cx/gpt-6.2-sol");
    expect(mocks.generateStoryboard).toHaveBeenCalledOnce();
    expect(mocks.createProjectWithPlan).toHaveBeenCalledOnce();
  });

  it("memakai model override bila diberikan", async () => {
    const { POST } = await import("@/app/api/generate/route");
    await POST(makeRequest({ ...validInput, model: "model-khusus" }));

    expect(mocks.generateStoryboard).toHaveBeenCalledWith(
      expect.objectContaining({ model: "model-khusus" }),
    );
  });

  it("menolak deskripsi yang terlalu pendek", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const response = await POST(makeRequest({ ...validInput, description: "pendek" }));
    expect(response.status).toBe(400);
    expect(mocks.generateStoryboard).not.toHaveBeenCalled();
  });

  it("mengembalikan 502 ketika AI gagal", async () => {
    mocks.generateStoryboard.mockRejectedValue(new Error("Gagal membuat rencana video"));
    const { POST } = await import("@/app/api/generate/route");
    const response = await POST(makeRequest(validInput));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(payload.error).toContain("Gagal membuat rencana video");
    expect(mocks.createProjectWithPlan).not.toHaveBeenCalled();
  });
});
