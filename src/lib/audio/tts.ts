import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { CaptionWord, VideoPlan } from "../plan/schema";

/**
 * Narasi suara memakai Edge TTS (Microsoft, tanpa API key) yang punya suara
 * Bahasa Indonesia. Hasilnya file MP3 di `public/audio/<projectId>/` plus
 * durasi dan timing kata per scene, sehingga gambar dan caption mengikuti
 * panjang kalimat — bukan sebaliknya seperti video teks tanpa suara.
 */

export const TTS_VOICES = {
  male: "id-ID-ArdiNeural",
  female: "id-ID-GadisNeural",
} as const;

export type TtsVoice = keyof typeof TTS_VOICES;

export type NarrationResult = {
  enabled: boolean;
  voice: string;
  dir: string;
  scenes: number;
  totalSeconds: number;
  error?: string;
};

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

/** Edge TTS melaporkan offset/duration dalam tick 100 nanodetik. */
const TICKS_PER_SECOND = 10_000_000;
/** Lantai durasi satu kata saat metadata tidak tersedia. */
const MIN_WORD_SECONDS = 0.08;

const cleanForSpeech = (text: string): string =>
  text
    .replace(/\s*[·•]\s*/g, ", ")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const narrationFor = (plan: VideoPlan, index: number): string => {
  const scene = plan.scenes[index];
  const spoken = scene.narration?.trim();
  if (spoken) return cleanForSpeech(spoken);
  const fallback = [scene.heading, scene.quote, scene.text, scene.label]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(". ");
  return cleanForSpeech(fallback);
};

/** Durasi audio via ffprobe bawaan Remotion (tidak butuh ffmpeg global). */
const probeSeconds = async (file: string): Promise<number> => {
  const ffprobe = path.join(
    process.cwd(),
    "node_modules",
    "@remotion",
    "compositor-win32-x64-msvc",
    "ffprobe.exe",
  );
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      windowsHide: true,
    });
    let out = "";
    child.stdout.on("data", (buffer: Buffer) => {
      out += buffer.toString();
    });
    child.on("error", () => resolve(0));
    child.on("close", () => {
      const value = Number.parseFloat(out.trim());
      resolve(Number.isFinite(value) ? value : 0);
    });
  });
};

export type NarrationOptions = {
  voice?: string;
  /** Kecepatan bicara Edge TTS, mis. "-6%" agar terdengar tenang. */
  rate?: string;
  pitch?: string;
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const numeric = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickNumber = (data: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = numeric(data[key]);
    if (value !== null) return value;
  }
  return null;
};

const pickText = (data: Record<string, unknown>): string => {
  const raw = data.text ?? data.Text;
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const nested = (raw as Record<string, unknown>).Text;
    if (typeof nested === "string") return nested.trim();
  }
  return "";
};

/** Susun timing menjadi monotone dan clamping ke durasi audio. */
const layoutWords = (words: CaptionWord[], scale: number): CaptionWord[] => {
  let cursor = 0;
  return words.map((word) => {
    const start = Math.max(cursor, word.s * scale);
    const end = Math.max(start + 0.001, word.e * scale);
    const item = {
      t: word.t,
      s: round3(start),
      e: Math.max(round3(end), round3(start) + 0.001),
    };
    cursor = item.e;
    return item;
  });
};

/** Metadata biasanya sudah urut; tetap sort/clamp untuk menjamin e > s. */
const normalizeWords = (words: CaptionWord[], seconds: number): CaptionWord[] => {
  const sorted = [...words]
    .map((word) => ({
      t: word.t,
      s: Number.isFinite(word.s) ? Math.max(0, word.s) : 0,
      e: Number.isFinite(word.e) ? Math.max(0, word.e) : 0,
    }))
    .sort((a, b) => a.s - b.s);
  const last = sorted[sorted.length - 1]?.e ?? 0;
  const scale = last > seconds && seconds > 0 ? seconds / last : 1;
  return layoutWords(sorted, scale);
};

/** Fallback saat metadata tidak ada/kosong/rusak: bagi durasi per panjang kata. */
const fallbackWords = (input: string, seconds: number): CaptionWord[] => {
  const tokens = input.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || seconds <= 0) return [];
  const weights = tokens.map((token) => Math.max(token.length, 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const durations = weights.map((weight) =>
    Math.max(MIN_WORD_SECONDS, (seconds * weight) / totalWeight),
  );
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const scale = total > seconds ? seconds / total : 1;
  return layoutWords(
    tokens.map((t, index) => ({ t, s: 0, e: durations[index] * scale })),
    1,
  );
};

/**
 * Baca `metadata.json` hasil `toFile()` dan konversi WordBoundary menjadi
 * `{t, s, e}` relatif terhadap awal scene. Bila metadata gagal dibaca, pakai
 * pembagian proporsional dari teks narasi.
 */
const readBoundaryWords = async (
  metadataPath: string | null,
  input: string,
  seconds: number,
): Promise<CaptionWord[]> => {
  const fromMetadata: CaptionWord[] = [];
  if (metadataPath) {
    try {
      const parsed = JSON.parse(await fs.readFile(metadataPath, "utf8")) as {
        Metadata?: unknown;
      };
      const items = Array.isArray(parsed.Metadata) ? parsed.Metadata : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const entry = item as { Type?: unknown; Data?: unknown };
        if (entry.Type !== "WordBoundary") continue;
        const data = (
          entry.Data && typeof entry.Data === "object" ? entry.Data : {}
        ) as Record<string, unknown>;
        const t = pickText(data);
        const offset = pickNumber(data, "offset", "Offset");
        const duration = pickNumber(data, "duration", "Duration");
        if (!t || offset === null || duration === null) continue;
        const s = offset / TICKS_PER_SECOND;
        const e = s + duration / TICKS_PER_SECOND;
        if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
        fromMetadata.push({ t, s, e });
      }
    } catch {
      // metadata rusak → fallback di bawah
    }
  }
  return fromMetadata.length > 0
    ? normalizeWords(fromMetadata, seconds)
    : fallbackWords(input, seconds);
};

/**
 * Membuat narasi untuk semua scene. Bila satu scene gagal, scene itu tetap
 * tanpa audio dan render lanjut (kegagalan suara tidak boleh menggagalkan video).
 */
export const attachNarration = async (
  plan: VideoPlan,
  projectId: string,
  options: NarrationOptions = {},
): Promise<{ plan: VideoPlan; result: NarrationResult }> => {
  const voice = options.voice ?? TTS_VOICES.male;
  const rate = options.rate ?? "-4%";
  const dirName = projectId;
  const dir = path.join(AUDIO_DIR, dirName);
  const publicDir = `/audio/${dirName}`;

  const result: NarrationResult = {
    enabled: false,
    voice,
    dir: publicDir,
    scenes: 0,
    totalSeconds: 0,
  };

  await fs.mkdir(dir, { recursive: true });

  const scenes = [...plan.scenes];
  let totalSeconds = 0;

  for (let index = 0; index < scenes.length; index += 1) {
    const text = narrationFor(plan, index);
    if (text.length < 3) continue;

    const fileName = `scene-${String(index + 1).padStart(2, "0")}.mp3`;
    const filePath = path.join(dir, fileName);
    // toFile() selalu menulis audio.mp3 + metadata.json ke folder yang sama.
    // Pakai folder temp agar metadata tidak menumpuk di public/.
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "edge-tts-"));

    try {
      const tts = new MsEdgeTTS();
      let generated: Awaited<ReturnType<MsEdgeTTS["toFile"]>> | undefined;
      try {
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
          wordBoundaryEnabled: true,
          sentenceBoundaryEnabled: false,
        });
        generated = await tts.toFile(tempDir, text, {
          rate,
          pitch: options.pitch ?? "+0Hz",
        });
      } finally {
        tts.close();
      }

      const buffer = await fs.readFile(generated.audioFilePath);
      if (buffer.byteLength < 1200) continue;
      await fs.copyFile(generated.audioFilePath, filePath);

      const seconds = await probeSeconds(filePath);
      if (seconds <= 0.2) continue;

      const words = await readBoundaryWords(generated.metadataFilePath, text, seconds);

      scenes[index] = {
        ...scenes[index],
        audio: { src: `${publicDir}/${fileName}`, seconds: Number(seconds.toFixed(3)) },
        words,
      };
      totalSeconds += seconds;
      result.scenes += 1;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  result.enabled = result.scenes > 0;
  result.totalSeconds = Number(totalSeconds.toFixed(3));

  return { plan: { ...plan, scenes }, result };
};

/** Hapus folder audio project (dipanggil saat project dihapus). */
export const removeNarration = async (projectId: string): Promise<void> => {
  await fs.rm(path.join(AUDIO_DIR, projectId), { recursive: true, force: true }).catch(() => undefined);
};
