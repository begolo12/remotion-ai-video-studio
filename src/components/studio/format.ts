import type { Scene } from "@/lib/plan/schema";

/** Ambil pesan yang aman ditampilkan dari error apa pun. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "Terjadi kesalahan tak terduga.";
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak dikenal";
  return dateFormatter.format(date);
};

/** "30 detik" / "1 menit" / "1,5 menit" */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)} detik`;
  const minutes = seconds / 60;
  const formatted = Number.isInteger(minutes)
    ? String(minutes)
    : minutes.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return `${formatted} menit`;
};

/** Durasi satu scene dalam detik, mis. "3,0 dtk". */
export const formatSceneSeconds = (frames: number, fps = 30): string => {
  const seconds = frames / fps;
  const formatted = seconds.toLocaleString("id-ID", {
    minimumFractionDigits: seconds < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  });
  return `${formatted} dtk`;
};

/** Waktu relatif dalam video, mis. "0:12". */
export const formatClock = (frames: number, fps = 30): string => {
  const total = Math.max(0, Math.round(frames / fps));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const formatCount = (value: number): string =>
  value.toLocaleString("id-ID");

/** Teks utama + teks pendukung yang benar-benar tersedia pada sebuah scene. */
export const sceneTexts = (
  scene: Scene,
): { primary: string; secondary: string | null } => {
  const primary =
    scene.heading ??
    scene.quote ??
    scene.text ??
    scene.value ??
    scene.bullets?.join(" · ") ??
    scene.subheading ??
    scene.label ??
    scene.narration ??
    "Scene tanpa teks";

  const secondaryParts: string[] = [];
  const push = (value?: string) => {
    const clean = value?.trim();
    if (clean && clean !== primary && !secondaryParts.includes(clean)) {
      secondaryParts.push(clean);
    }
  };

  if (scene.heading) {
    push(scene.subheading);
    push(scene.text);
    if (scene.bullets?.length) push(scene.bullets.join(" · "));
  } else if (scene.value) {
    push(scene.label);
  } else if (scene.quote) {
    push(scene.author ? `— ${scene.author}` : undefined);
  } else if (scene.text) {
    push(scene.subheading);
  }
  push(scene.narration);

  return {
    primary,
    secondary: secondaryParts.length > 0 ? secondaryParts.join(" · ") : null,
  };
};

export const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "short-video";
};
