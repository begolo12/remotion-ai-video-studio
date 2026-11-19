import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { CaptionWord, VideoPlan } from "../plan/schema";
import { putObject } from "../storage/blob";

/**
 * Narasi untuk lingkungan serverless. Berbeda dengan tts.ts yang menulis ke
 * public/, modul ini mengunggah MP3 ke Vercel Blob dan mengembalikan URL
 * publik yang bisa dipakai Remotion, baik di Player maupun saat render.
 */

export const TTS_VOICES = {
  male: "id-ID-ArdiNeural",
  female: "id-ID-GadisNeural",
} as const;

export type TtsVoice = keyof typeof TTS_VOICES;

export type CloudNarrationResult = {
  enabled: boolean;
  voice: string;
  scenes: number;
  totalSeconds: number;
  error?: string;
};

const TICKS_PER_SECOND = 10_000_000;
const MIN_WORD_SECONDS = 0.08;
const TAIL_SECONDS = 0.35;

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
  return cleanForSpeech(
    [scene.heading, scene.quote, scene.text, scene.label]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(". "),
  );
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

const fallbackWords = (input: string, seconds: number): CaptionWord[] => {
  const tokens = input.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || seconds <= 0) return [];
  const weights = tokens.map((token) => Math.max(token.length, 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const durations = weights.map((weight) => Math.max(MIN_WORD_SECONDS, (seconds * weight) / totalWeight));
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const scale = total > seconds ? seconds / total : 1;
  return layoutWords(
    tokens.map((t, index) => ({ t, s: 0, e: durations[index] * scale })),
    1,
  );
};

const readMetadata = async (
  metadataPath: string | null,
): Promise<{ words: CaptionWord[]; seconds: number | null }> => {
  let lastEnd: number | null = null;
  const words: CaptionWord[] = [];

  if (metadataPath) {
    try {
      const parsed = JSON.parse(await fs.readFile(metadataPath, "utf8")) as { Metadata?: unknown };
      const items = Array.isArray(parsed.Metadata) ? parsed.Metadata : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const entry = item as { Type?: unknown; Data?: unknown };
        if (entry.Type !== "WordBoundary") continue;
        const data = (entry.Data && typeof entry.Data === "object" ? entry.Data : {}) as Record<string, unknown>;
        const t = pickText(data);
        const offset = pickNumber(data, "offset", "Offset");
        const duration = pickNumber(data, "duration", "Duration");
        if (!t || offset === null || duration === null) continue;
        const s = offset / TICKS_PER_SECOND;
        const e = s + duration / TICKS_PER_SECOND;
        if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
        words.push({ t, s: round3(s), e: round3(e) });
        lastEnd = lastEnd === null ? e : Math.max(lastEnd, e);
      }
    } catch {
      // metadata rusak → fallback
    }
  }

  if (words.length === 0) {
    return { words: [], seconds: null };
  }

  const seconds = lastEnd === null ? null : round3(lastEnd + TAIL_SECONDS);
  return { words: layoutWords(words, 1), seconds };
};

/** Estimasi durasi MP3 CBR 48 kbps bila metadata word boundary tidak ada. */
const estimateSecondsFromFile = async (file: string): Promise<number | null> => {
  try {
    const stat = await fs.stat(file);
    const bytesPerSecond = 48_000 / 8;
    const seconds = (stat.size - 2048) / bytesPerSecond;
    return seconds > 0.2 ? round3(seconds) : null;
  } catch {
    return null;
  }
};

export type CloudNarrationOptions = {
  voice?: string;
  rate?: string;
  pitch?: string;
  /** Prefix storage key agar mudah dikelompokkan per project. */
  keyPrefix?: string;
};

export const attachCloudNarration = async (
  plan: VideoPlan,
  projectId: string,
  options: CloudNarrationOptions = {},
): Promise<{ plan: VideoPlan; result: CloudNarrationResult }> => {
  const voice = options.voice ?? TTS_VOICES.male;
  const rate = options.rate ?? "-4%";
  const prefix = options.keyPrefix ?? projectId;

  const result: CloudNarrationResult = {
    enabled: false,
    voice,
    scenes: 0,
    totalSeconds: 0,
  };

  const scenes = [...plan.scenes];
  let totalSeconds = 0;

  for (let index = 0; index < scenes.length; index += 1) {
    const text = narrationFor(plan, index);
    if (text.length < 3) continue;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "edge-tts-cloud-"));

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

      const metadata = await readMetadata(generated.metadataFilePath);
      const seconds = metadata.seconds ?? (await estimateSecondsFromFile(generated.audioFilePath));
      if (!seconds || seconds <= 0.2) continue;

      const words =
        metadata.words.length > 0 ? layoutWords(metadata.words, 1) : fallbackWords(text, seconds);

      const objectName = `${prefix}/scene-${String(index + 1).padStart(2, "0")}-${randomUUID().slice(0, 8)}.mp3`;
      const stored = await putObject({
        data: buffer,
        filename: objectName,
        contentType: "audio/mpeg",
        access: "public",
      });

      scenes[index] = {
        ...scenes[index],
        audio: { src: stored.url, seconds: round3(seconds) },
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
  result.totalSeconds = round3(totalSeconds);
  return { plan: { ...plan, scenes }, result };
};
