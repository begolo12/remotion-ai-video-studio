import { normalizePlan, PlanValidationError } from "../plan/normalize";
import type { GenerateRequest, VideoPlan } from "../plan/schema";
import { chatCompletion, getRouterConfig, RouterError, type ChatMessage } from "./router";

export type GenerateOutcome = {
  plan: VideoPlan;
  model: string;
  fellBack: boolean;
  log: string[];
};

const SYSTEM_PROMPT = `Kamu penulis skenario DAN storyboard YouTube Shorts berbahasa Indonesia. Videonya bukan slide teks: setiap scene adalah **ilustrasi SVG bergaya explainer** (benda nyata, bukan grafis abstrak) dengan narasi yang dibacakan suara mesin.

ATURAN WAJIB
1. Balas HANYA satu objek JSON valid. Tanpa markdown, tanpa penjelasan.
2. Setiap scene WAJIB punya "narration": 12-22 kata, satu atau dua kalimat pendek, bahasa lisan.
3. Setiap scene WAJIB punya "visual": salah satu DARI DAFTAR INI SAJA: vehicle, container, factory, ship, globe, pipeline, chart, phone, person, house, mountain, lab, money, food, network, finale. Pilih benda yang benar-benar menggambarkan kalimatnya — jangan selalu sama. Contoh: minyak → container/factory/pipeline; uang → money; lokasi → globe/mountain; teknologi → phone/network; orang → person; hasil → chart; penutup → finale.
4. Setiap scene WAJIB punya "chapter" (judul bab HURUF BESAR, maks 5 kata, sama untuk beberapa scene berurutan), "chapterSub" (maks 4 kata), dan "keyword" (1 kata yang disorot kuning di label bab).
5. Setiap scene boleh punya "callouts": 1-3 label benda di ilustrasi (maks 2 kata setiap label), mis. ["tangki", "pipa"].
6. "heading" maksimal 6 kata; ini judul besar di ilustrasi, BUKAN salinan narasi.
7. Angka yang diucapkan ditulis huruf ("delapan puluh dua persen"); angka di layar tetap "82%".
8. Hook (scene pertama) mengajukan pertanyaan, TIDAK langsung menjawab. Outro = ajakan singkat.
9. Bahasa Indonesia natural, hindari klise.
10. Variasikan visual antar scene bersebelahan agar tidak membosankan.

SKEMA
{
  "version": 1,
  "title": "maks 60 karakter",
  "hook": "kalimat pembuka maks 12 kata",
  "styleId": "cinematic | neon | minimal | bold | retro",
  "targetSeconds": 30,
  "scenes": [
    {
      "template": "hook | bullets | stat | quote | statement | outro",
      "visual": "vehicle | container | factory | ship | globe | pipeline | chart | phone | person | house | mountain | lab | money | food | network | finale",
      "chapter": "PERJALANAN BENSIN",
      "chapterSub": "Perjalanan",
      "keyword": "bensin",
      "callouts": ["motor", "tangki"],
      "heading": "maks 6 kata",
      "subheading": "opsional maks 10 kata",
      "narration": "12-22 kata"
    }
  ],
  "outro": { "heading": "maks 6 kata", "cta": "maks 6 kata" },
  "caption": "caption YouTube maks 3 kalimat",
  "hashtags": ["#shorts", "#topik"],
  "musicMood": "deskripsi suasana musik"
}

Jumlah scene isi: 15-30 detik = 3-4 scene, 31-60 detik = 4-6 scene, 61-180 detik = 6-9 scene.
Field "weight" (0.4-3) boleh dipakai pada scene yang butuh waktu lebih lama.`;

const buildMessages = (
  request: GenerateRequest,
  seconds: number,
  repair?: { previous: string; error: string },
): ChatMessage[] => {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Deskripsi ide video: ${request.description}
Durasi target: ${seconds} detik.
Gaya visual: ${request.styleId}.
Buat rencana video JSON sesuai skema.`,
    },
  ];

  if (repair) {
    messages.push({ role: "assistant", content: repair.previous.slice(0, 4000) });
    messages.push({
      role: "user",
      content: `Jawaban sebelumnya tidak valid: ${repair.error}. Balas ulang HANYA dengan JSON valid sesuai skema.`,
    });
  }

  return messages;
};

/** Mengambil objek JSON pertama dari teks bebas (AI kadang menambah basa-basi). */
export const extractJson = (raw: string): unknown => {
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed: unknown = JSON.parse(text);
    // AI kadang hanya mengirim array scene; bungkus agar sesuai skema plan.
    return Array.isArray(parsed) ? { scenes: parsed } : parsed;
  } catch {
    // lanjut ke pencarian blok JSON
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* jatuh ke bawah */
    }
  }

  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      const parsed = JSON.parse(text.slice(arrayStart, arrayEnd + 1));
      if (Array.isArray(parsed)) return { scenes: parsed };
    } catch {
      /* jatuh ke bawah */
    }
  }

  throw new PlanValidationError("Jawaban AI tidak mengandung JSON yang bisa dibaca");
};

const modelsToTry = (requested?: string): string[] => {
  const config = getRouterConfig();
  const chain = [requested, config.model, config.fallbackModel].filter(
    (model): model is string => Boolean(model && model.trim()),
  );
  return [...new Set(chain)];
};

/**
 * Minta AI menulis rencana video. Mencoba model yang diminta, model default,
 * lalu model cadangan. Setiap model diberi 2 kesempatan (dengan perbaikan).
 */
export const generatePlan = async (request: GenerateRequest): Promise<GenerateOutcome> => {
  const chain = modelsToTry(request.model);
  const log: string[] = [];
  let lastError: Error | undefined;

  for (const model of chain) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await chatCompletion({
          model,
          messages: buildMessages(request, request.targetSeconds),
          temperature: attempt === 1 ? 0.7 : 0.3,
        });
        const raw = result.content || result.reasoning || "";
        const parsed = extractJson(raw);
        const plan = normalizePlan(parsed, {
          styleId: request.styleId,
          targetSeconds: request.targetSeconds,
          fallbackHook: request.description.slice(0, 120),
        });
        log.push(`${model}: berhasil (percobaan ${attempt})`);
        return {
          plan,
          model,
          fellBack: model !== (request.model ?? getRouterConfig().model),
          log,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const reason =
          error instanceof PlanValidationError
            ? `${error.message}${error.detail ? ` (${error.detail})` : ""}`
            : error instanceof RouterError
              ? `${error.message}${error.status ? ` [${error.status}]` : ""}${error.detail ? ` ${error.detail}` : ""}`
              : String(error);
        log.push(`${model}: gagal percobaan ${attempt} — ${reason}`);
      }
    }
  }

  const detail = lastError?.message ?? "Semua model gagal";
  throw new PlanValidationError("Gagal membuat rencana video dari AI", detail);
};
