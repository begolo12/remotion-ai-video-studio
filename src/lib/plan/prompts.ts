import type { StyleId } from "./schema";
import type { PlanV2, V2Scene } from "./v2";

export type StoryboardPromptInput = {
  prompt: string;
  targetSeconds: number;
  styleId: StyleId;
  language?: string;
  audience?: string;
  tone?: string;
  targetPlatform?: PlanV2["targetPlatform"];
};

export type SceneRegeneratePromptInput = {
  plan: PlanV2;
  scene: V2Scene;
  instruction: string;
};

export type RewritePromptInput = {
  text: string;
  instruction: string;
  language?: string;
};

const JSON_ONLY =
  "Balas HANYA satu objek JSON yang valid. Jangan pakai markdown, code fence (```), atau kalimat penjelas di luar JSON.";

const CREATIVE_RULES = `ATURAN KREATIF WAJIB
- Jumlah scene 4-12, disesuaikan durasi: 15-30 detik = 4-5 scene; 31-60 detik = 5-7; 61-120 detik = 7-10; 121-180 detik = 10-12.
- Scene pertama adalah hook: ajukan pertanyaan atau ketegangan, JANGAN langsung menjawab.
- Setiap caption maksimal 4 kata per grup; gunakan jeda antar grup sehingga mudah dibaca di layar 9:16.
- Dilarang mengarang statistik, angka, tanggal, atau kutipan tanpa sumber. Bila tidak ada sumber, tulis sebagai ilustrasi umum atau hindari angka sama sekali.
- Visual WAJIB mendukung narasi scene itu, bukan dekorasi. Pilih objek nyata yang benar-benar disebut narasi.
- Hindari slide teks generik: selalu ada arahan ilustrasi (subject, komposisi, pencahayaan, mood) pada setiap scene.
- Patuhi safe zone 9:16: teks dan subjek penting tidak mepet ke tepi, sisihkan ruang untuk caption bawah.
- Bahasa Indonesia yang natural, lisan, dan ringkas. Hindari klise dan kalimat panjang.
- Variasikan kamera dan visual antar scene bersebelahan agar tidak monoton.`;

const SCENE_SHAPE = `Bentuk setiap scene:
{
  "id": "string unik", "order": 1, "type": "hook|bullets|stat|quote|statement|outro",
  "purpose": "tujuan scene", "visual": "vehicle|container|factory|ship|globe|pipeline|chart|phone|person|house|mountain|lab|money|food|network|finale",
  "durationSeconds": 0.5-120, "heading": "maks 90 karakter", "narration": "maks 300 karakter",
  "caption": "maks 4 kata per grup", "visualDirection": "arahan visual maks 300 karakter",
  "camera": "push-in|pull-out|pan-left|pan-right|static", "transitionIn": "fade|cut|slide",
  "assetBrief": { "subject": "...", "composition": "...", "lighting": "...", "mood": "...", "aspectRatio": "9:16", "negativePrompt": "opsional" },
  "assetRefs": [], "weight": 0.4-3
}
Field opsional yang dipakai bila relevan: subheading, bullets (1-5), value, label, quote, author, text,
chapter, chapterSub, keyword, callouts (1-3), emphasis.`;

export const SYSTEM_STORYBOARD = `Kamu adalah sutradara dan penulis storyboard YouTube Shorts berbahasa Indonesia.
Kamu menghasilkan RENCANA TERSTRUKTUR sebagai JSON, bukan kode, bukan TSX, bukan komponen React.

${JSON_ONLY}

${CREATIVE_RULES}

${SCENE_SHAPE}

Struktur plan utuh:
{
  "schemaVersion": 2,
  "id": "string unik", "title": "maks 100 karakter", "prompt": "ide asli user",
  "language": "id", "audience": "...", "tone": "...",
  "targetPlatform": "youtube-shorts|tiktok|instagram-reels",
  "targetSeconds": 30, "styleId": "cinematic|neon|minimal|bold|retro",
  "styleBible": { "palette": ["#...", "#..."], "typography": "...", "captionStyle": "...",
    "backgroundStyle": "...", "cameraLanguage": "...", "transitionLanguage": "...",
    "visualDensity": "low|medium|high", "lighting": "...", "texture": "...", "prohibitedPatterns": [] },
  "hook": "maks 120 karakter", "keyMessage": "maks 200 karakter",
  "scenes": [ ... ],
  "outro": { "heading": "maks 90 karakter", "cta": "maks 120 karakter" },
  "publishing": { "title": "...", "description": "...", "hashtags": ["#shorts"],
    "pinnedComment": "...", "thumbnailText": "maks 60 karakter" },
  "quality": [], "createdAt": "ISO timestamp", "updatedAt": "ISO timestamp"
}`;

const contextLine = (input: StoryboardPromptInput): string =>
  `Ide video: ${input.prompt}
Durasi target: ${input.targetSeconds} detik.
Gaya visual: ${input.styleId}.
Bahasa: ${input.language ?? "id"}.
Audience: ${input.audience ?? "penonton umum"}.
Nada: ${input.tone ?? "informatif dan ringkas"}.
Platform: ${input.targetPlatform ?? "youtube-shorts"}.`;

export const buildStoryboardPrompt = (input: StoryboardPromptInput): string =>
  `${contextLine(input)}

Buat storyboard lengkap sesuai skema. Isi styleBible dengan keputusan desain yang konsisten untuk seluruh video.
Kembalikan objek JSON plan dengan schemaVersion 2. ${JSON_ONLY}`;

export const buildBriefPrompt = (input: StoryboardPromptInput): string =>
  `${contextLine(input)}

Rumuskan brief kreatif sebelum menulis storyboard. ${JSON_ONLY}
Keluarkan objek:
{
  "angle": "sudut pandang/sudut cerita yang membedakan video ini",
  "audience": "siapa penontonnya dan apa yang mereka pedulikan",
  "promise": "janji nilai yang diterima penonton dalam ${input.targetSeconds} detik",
  "emotionalArc": "urutan emosi dari hook sampai outro",
  "keyFacts": ["fakta yang boleh dipakai, atau kosongkan bila tidak ada sumber"],
  "exclusions": ["hal yang tidak boleh dikarang atau dibahas"]
}
Jangan mengarang statistik atau kutipan. ${CREATIVE_RULES}`;

export const buildSceneRegeneratePrompt = ({
  plan,
  scene,
  instruction,
}: SceneRegeneratePromptInput): string =>
  `Video: "${plan.title}" (gaya ${plan.styleId}, ${plan.targetSeconds} detik).
Scene yang akan ditulis ulang (id ${scene.id}, urutan ${scene.order}):
${JSON.stringify(scene)}

Instruksi revisi: ${instruction}

Tulis ulang HANYA scene tersebut sebagai satu objek JSON scene yang valid (bentuk seperti pada skema scene).
Pertahankan "id" ${JSON.stringify(scene.id)} dan "order" ${scene.order}.
Jangan mengubah durasi total video. ${JSON_ONLY}
${CREATIVE_RULES}
${SCENE_SHAPE}`;

export const buildReviewPrompt = (plan: PlanV2): string =>
  `Tinjau rencana video berikut sebagai quality control:
${JSON.stringify(plan)}

Cari masalah pada: hook yang lemah, narasi tanpa sumber statistik, caption lebih dari 4 kata per grup,
visual yang tidak mendukung narasi, slide teks generik, scene di luar safe zone 9:16, durasi tidak seimbang,
dan konsistensi style bible. ${JSON_ONLY}
Keluarkan objek: { "issues": [ { "code": "kode_singkat", "severity": "error|warning|info",
"message": "penjelasan singkat", "sceneId": "id scene bila relevan" } ] }.
Bila tidak ada masalah, kembalikan { "issues": [] }.`;

export const buildMetadataPrompt = (plan: PlanV2): string =>
  `Buat metadata publikasi untuk video berikut:
${JSON.stringify({ title: plan.title, hook: plan.hook, styleId: plan.styleId, scenes: plan.scenes.map((scene) => scene.heading) })}

${JSON_ONLY}
Keluarkan objek:
{
  "title": "judul YouTube maks 100 karakter, menarik tapi tidak clickbait",
  "description": "deskripsi maks 1200 karakter, 2-3 kalimat",
  "hashtags": ["#shorts", maksimal 15 tag, tiap tag maks 40 karakter],
  "pinnedComment": "ajakan diskusi singkat",
  "thumbnailText": "teks thumbnail maks 60 karakter"
}
Jangan mengarang statistik atau klaim yang tidak ada di video. ${CREATIVE_RULES}`;

export const buildRewritePrompt = ({ text, instruction, language }: RewritePromptInput): string =>
  `Teks asli:
${text}

Instruksi: ${instruction}

Tulis ulang teks tersebut dalam Bahasa Indonesia${language ? ` (${language})` : ""} yang natural dan ringkas.
${JSON_ONLY}
Keluarkan objek: { "text": "hasil tulis ulang, maksimal 300 karakter" }.
Jangan menambah fakta, angka, atau kutipan yang tidak ada di teks asli.`;
