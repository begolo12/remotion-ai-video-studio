import type { PlanV2 } from "@/lib/plan/v2";

export type ReadinessCheck = {
  code: string;
  label: string;
  passed: boolean;
  severity: "error" | "warning";
  detail?: string;
};

const check = (
  code: string,
  label: string,
  passed: boolean,
  severity: "error" | "warning",
  detail?: string,
): ReadinessCheck => ({ code, label, passed, severity, detail });

const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

/**
 * Pemeriksaan akhir sebelum render. Error menghalangi ekspor; warning hanya
 * memberi tahu bahwa kualitas bisa ditingkatkan.
 */
export function checkExportReadiness(
  plan: PlanV2,
  opts: { assets?: unknown[]; narration?: { enabled: boolean; scenes: number } | null } = {},
): ReadinessCheck[] {
  const result: ReadinessCheck[] = [];
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : [];

  result.push(
    check("TITLE", "Judul video ada", Boolean(plan?.title?.trim()), "error"),
  );
  result.push(
    check("HOOK", "Hook pembuka ada", Boolean(plan?.hook?.trim()), "error"),
  );
  result.push(
    check(
      "SCENE_COUNT",
      "Jumlah scene antara 1 dan 16",
      scenes.length >= 1 && scenes.length <= 16,
      "error",
      `Ditemukan ${scenes.length} scene`,
    ),
  );

  const totalSeconds =
    typeof plan?.targetSeconds === "number"
      ? plan.targetSeconds
      : scenes.reduce((sum, scene) => sum + (Number(scene?.durationSeconds) || 0), 0);
  result.push(
    check(
      "TOTAL_DURATION",
      "Total durasi antara 15 dan 180 detik",
      totalSeconds >= 15 && totalSeconds <= 180,
      "error",
      `Total durasi ${totalSeconds} detik`,
    ),
  );

  for (const scene of scenes) {
    const sceneId = scene?.id ?? "tanpa-id";
    result.push(
      check(
        "SCENE_NARRATION",
        `Scene ${sceneId} memiliki narasi`,
        Boolean(scene?.narration?.trim()),
        "error",
      ),
    );
    result.push(
      check(
        "SCENE_VISUAL",
        `Scene ${sceneId} memiliki visual`,
        Boolean(scene?.visual),
        "error",
      ),
    );
    result.push(
      check(
        "SCENE_DURATION",
        `Scene ${sceneId} berdurasi minimal 2 detik`,
        Number(scene?.durationSeconds) >= 2,
        "error",
        `Durasi ${scene?.durationSeconds ?? 0} detik`,
      ),
    );

    const captionWords = words(scene?.caption ?? "");
    result.push(
      check(
        "CAPTION_LENGTH",
        `Caption scene ${sceneId} tidak lebih dari 6 kata`,
        captionWords.length <= 6,
        "warning",
        `${captionWords.length} kata`,
      ),
    );

    const refs = Array.isArray(scene?.assetRefs) ? scene.assetRefs : [];
    const refsValid = refs.every((ref) => typeof ref === "string" && ref.trim().length > 0);
    // Scene tanpa aset eksternal sah karena renderer punya ilustrasi SVG bawaan.
    result.push(
      check(
        "ASSET_REFS",
        `Referensi aset scene ${sceneId} valid`,
        refsValid,
        "warning",
        refs.length === 0 ? "memakai ilustrasi bawaan" : undefined,
      ),
    );
  }

  result.push(
    check(
      "OUTRO_CTA",
      "Outro memiliki call to action",
      Boolean(plan?.outro?.cta?.trim()),
      "error",
    ),
  );

  const narration = opts.narration;
  if (!narration) {
    result.push(
      check(
        "NARRATION_MODE",
        "Status narasi sudah diputuskan",
        false,
        "warning",
        "Narasi belum ditentukan aktif atau sengaja dimatikan",
      ),
    );
  } else if (narration.enabled) {
    const narrated = scenes.filter((scene) => Boolean(scene?.narration?.trim())).length;
    result.push(
      check(
        "NARRATION_MODE",
        "Jumlah scene bersuara sesuai pengaturan narasi",
        narrated >= narration.scenes && narrated > 0,
        "warning",
        `${narrated} scene bersuara dari ${narration.scenes} yang diharapkan`,
      ),
    );
  } else {
    const narrated = scenes.filter((scene) => Boolean(scene?.narration?.trim())).length;
    result.push(
      check(
        "NARRATION_MODE",
        "Narasi dimatikan dan tidak ada teks narasi",
        narrated === 0,
        "warning",
        `Masih ada ${narrated} scene dengan teks narasi`,
      ),
    );
  }

  void opts.assets;
  return result;
}
