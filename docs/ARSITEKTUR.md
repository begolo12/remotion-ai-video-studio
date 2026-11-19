# Arsitektur Short Video Studio

Dokumen ini menjelaskan bagaimana satu deskripsi ide berubah menjadi file MP4 bersuara, modul apa yang terlibat, kontrak API yang tersedia, dan cara memperluas sistem. Untuk instalasi dan pemakaian, lihat [`README.md`](../README.md).

## Prinsip

1. **AI tidak menulis kode.** AI hanya mengisi objek JSON sesuai skema zod. Tidak ada TSX, tidak ada `eval`, tidak ada kode dari jaringan yang dijalankan.
2. **Satu rencana, dua konsumen.** Rencana video (`VideoPlan`) yang sama dipakai untuk preview di browser (`@remotion/player`) dan untuk render MP4 (`@remotion/cli`).
3. **Penyimpanan transparan.** Project disimpan sebagai file JSON biasa; tidak ada database yang perlu dijalankan.
4. **Kegagalan model bukan kegagalan aplikasi.** Rantai model + normalisasi longgar membuat jawaban AI yang "hampir benar" tetap bisa dipakai. Kegagalan suara juga tidak menggagalkan video: scene tanpa audio tetap dirender.
5. **Teks harus defensif.** Keluaran AI tidak bisa dipercaya panjangnya, jadi setiap scene memakai `WRAP`, `fitSize`, dan `SceneShell` (safe zone).
6. **Gambar mengikuti suara, bukan sebaliknya.** Bila narasi ada, durasi tiap scene dihitung dari durasi MP3 + ekor 0,35 detik, sehingga kalimat tidak terpotong. `targetSeconds` jadi acuan jumlah scene, bukan durasi final.
7. **Visual harus terbaca di aplikasi platform.** Semua teks penting berada di dalam `SAFE`, area yang tidak tertutup UI TikTok/Reels. Caption punya jalur sendiri di bawah konten.
8. **Deterministik.** Semua animasi hanya fungsi dari `frame`; tidak ada `Date.now()`, `Math.random()`, atau hook React di helper animasi, sehingga render ulang menghasilkan frame yang sama.

## Diagram alur

```
                       +----------------------------------+
   deskripsi ide ----> |  src/app/page.tsx                |
   durasi, gaya,       |  <StudioApp />                   |
   suara               |  form + <Player> + riwayat       |
                       +----------------+-----------------+
                                        | POST /api/generate
                                        | { description, targetSeconds, styleId, model?, voice?, withNarration? }
                                        v
                       +----------------------------------+
                       |  api/generate/route.ts           |
                       |  validasi generateRequestSchema  |
                       +----------------+-----------------+
                                        | generatePlan()
                                        v
                       +----------------------------------+
                       |  lib/ai/generate.ts              |
                       |  system prompt + rantai model    |
                       +----------------+-----------------+
                                        | chatCompletion()
                                        v
                       +----------------------------------+
                       |  lib/ai/router.ts                |
                       |  POST {baseUrl}/chat/completions |
                       +----------------+-----------------+
                                        | teks (JSON, kadang berbalut markdown)
                                        v
                       +----------------------------------+
                       |  extractJson -> normalizePlan    |
                       |  lib/plan/normalize.ts           |
                       +----------------+-----------------+
                                        | kandidat objek
                                        v
                       +----------------------------------+
                       |  planSchema (zod)                |
                       |  lib/plan/schema.ts              |
                       +----------------+-----------------+
                                        | VideoPlan (scene.narration terisi)
                                        v
                       +----------------------------------+
                       |  lib/audio/tts.ts                |  <- dilewati bila withNarration === false
                       |  attachNarration()               |
                       |  msedge-tts -> public/audio/<id> |
                       |  ffprobe -> scene.audio.seconds  |
                       +----------------+-----------------+
                                        | VideoPlan + scene.audio[]
                                        v
                       +----------------------------------+
                       |  lib/projects/store.ts           |
                       |  data/projects/<uuid>.json       |
                       +----------------+-----------------+
                                        | { project, plan, model, fellBack, narration, log }
                                        v
                       +----------------------------------+
                       |  <Player> komposisi "ShortVideo" |
                       |  video/design.ts + plan/timing.ts|
                       +----------------+-----------------+
                                        | POST /api/render { projectId }
                                        v
                       +----------------------------------+
                       |  api/render/route.ts             |
                       +----------------+-----------------+
                                        | startRender()
                                        v
                       +----------------------------------+
                       |  lib/render/jobs.ts              |
                       |  antrean: maks 2 render paralel  |
                       |  spawn node @remotion/cli render |
                       |  props: data/props/<jobId>.json  |
                       +----------------+-----------------+
                                        | stdout: "Rendered x/y"
                                        v
                       +----------------------------------+
                       |  public/renders/<id>-<ts>.mp4    |
                       |  (audio scene di-mux ke MP4)     |
                       |  props job dihapus setelah selesai|
                       +----------------+-----------------+
                                        | GET /api/render/<jobId>
                                        v
                              UI: progres, video, unduh
```

## Modul

### `src/lib/plan/schema.ts` — kontrak data

Satu-satunya sumber kebenaran untuk bentuk data. Berisi konstanta dan skema:

| Konstanta | Nilai | Dipakai untuk |
| --- | --- | --- |
| `FPS` | `30` | Komposisi Remotion dan perhitungan frame |
| `WIDTH` / `HEIGHT` | `1080` / `1920` | Kanvas vertikal 9:16 |
| `MIN_SECONDS` / `MAX_SECONDS` | `15` / `180` | Batas durasi input dan rencana |
| `STYLE_IDS` | `cinematic`, `neon`, `minimal`, `bold`, `retro` | Enum `styleId` |
| `SCENE_TEMPLATES` | `hook`, `bullets`, `stat`, `quote`, `statement`, `outro` | Enum `template` per scene |

Skema zod yang diekspor:

- `sceneSchema` — `template` wajib; `heading` (maks 90), `subheading` (140), `bullets` (1–5 item, masing-masing maks 80), `value` (12), `label` (60), `quote` (180), `author` (60), `text` (220), `narration` (300), `weight` (0.4–3), dan `audio { src, seconds }` (diisi server, bukan AI; `seconds` 0.2–120). Semua opsional kecuali `template`.
- `planSchema` — `version: 1`, `title` (100), `hook` (120), `styleId`, `targetSeconds` (15–180), `scenes` (1–16), `outro { heading, cta }`, `caption` (1200), `hashtags` (maks 15, default `[]`), `narration[]` (default `[]`), `musicMood?` (60), dan `music?` (200, path musik latar di `public/`).
- `generateRequestSchema` — body `POST /api/generate`: `description` 10–2000, `targetSeconds` bilangan bulat 15–180, `styleId`, `model?` (maks 120), `voice?: "male" | "female"`, `withNarration?: boolean`.
- `renderRequestSchema` — body `POST /api/render`: `projectId` 1–120.

Tipe turunan: `VideoPlan`, `Scene`, `Project`, `ProjectSummary`, `ProjectRender`. `Project.narration` menyimpan ringkasan hasil TTS (`enabled`, `voice`, `scenes`, `totalSeconds`, `error?`).

### `src/lib/plan/styles.ts` — token visual untuk UI

`STYLE_TOKENS` memetakan `StyleId` ke `StyleTokens`: `label`, `description`, `background`, `surface`, `text`, `muted`, `accent`, `accent2`, `fontDisplay`, `fontBody`, `uppercase`, `radius`, `vignette`, `glow`, `grain`, `line`. `STYLE_LIST` dipakai `style-picker.tsx`; `getStyleTokens(id)` dipakai `plan-panel.tsx`, `history-panel.tsx`, dan `studio-app.tsx` untuk label/warna panel.

Sejak v2, modul ini **tidak lagi dipakai komposisi video**. Video memakai `src/video/design.ts` (lihat di bawah). Pembagiannya: `styles.ts` = tampilan studio (web), `design.ts` = isi frame video. Keduanya memakai `StyleId` yang sama supaya pilihan gaya di UI konsisten dengan hasil render.

### `src/video/fonts.ts` — font bundled

Empat keluarga font dimuat lewat `@remotion/google-fonts` (lisensi OFL): **Anton**, **Inter**, **Playfair Display**, dan **Space Grotesk**. `loadFont()` mengembalikan `fontFamily` dan `waitUntilDone()`; pemanggilan di level modul membuat Remotion menahan render sampai file font siap, sehingga frame pertama tidak memakai font fallback lalu "melompat".

| Ekspor | Isi |
| --- | --- |
| `FONT.impact` | Anton (400) — display gaya `bold` |
| `FONT.sans` | Inter (400–800) — body semua gaya, display gaya `minimal` |
| `FONT.serif` | Playfair Display (500/700/800) — display gaya `cinematic`/`retro` |
| `FONT.grotesk` | Space Grotesk (500/600/700) — display gaya `neon` |
| `waitForFonts()` | Menunggu keempat font selesai dimuat; tersedia bila test/skrip butuh memastikan font siap (saat ini belum dipakai di kode) |

Karena Anton hanya punya weight 400, `design.ts` menyediakan `displayWeight(design)` (400 untuk `bold`, 800 untuk gaya lain) dan `displayLineHeight(design)` (0.94 untuk `bold`, 1.02 untuk gaya lain). Scene memakai kedua helper itu untuk teks display; scene yang butuh angka sangat rapat (mis. `StatScene`) menyesuaikan `lineHeight` sendiri.

### `src/video/design.ts` — safe zone + design token video

Dua bagian utama:

**`SAFE`** — kotak aman 9:16 yang diukur dari UI TikTok/Reels, memakai nilai terketat dari kedua aplikasi:

| Field | Nilai | Arti |
| --- | --- | --- |
| `top` | 212 | Batas bawah UI atas (Reels) |
| `bottom` | 1726 | Awal area caption/deskripsi platform |
| `left` | 88 | Margin kiri |
| `right` | 900 | Batas kiri kolom tombol kanan (tombol mulai x=927) |
| `captionBottom` | 452 | Jarak blok caption dari tepi bawah (≈24% tinggi frame) |
| `captionWidth` | 780 | Lebar maksimum blok caption |
| `contentBottom` | 1380 | Batas bawah area konten, di atas caption |

**`DESIGNS`** — `Record<StyleId, Design>` berisi 5 gaya. Field `Design`: `id`, `bgFrom`/`bgTo` (gradient latar), `blobs` (tiga warna blob), `grid`/`gridOpacity`/`gridOn`, `text`/`textMuted`, `accent`/`accent2`, `card`/`cardBorder`, `display`/`body` (fontFamily), `uppercase`, `tracking`, `radius`, `captionText`/`captionHighlight`/`captionOutline`, `grain`/`vignette`/`glow` (intensitas 0–1), dan `lightSurface` (true bila latar terang, sehingga bayangan/outline caption dibalik).

Helper: `alpha(hex, value)` mengubah hex menjadi `rgba()`, `readableOn(hex)` memilih teks hitam/putih berdasarkan luminansi, `getDesign(id)` mengambil token. `alpha` dan `readableOn` mencegah scene menulis rgba manual yang tidak konsisten.

### `src/lib/plan/timing.ts` — pembagian durasi

- `hasNarration(plan)` — true bila ada scene dengan `audio.seconds > 0.2`.
- `totalFramesFor(plan)` — `max(FPS, total frame scene + frame outro)`.
- `computeSceneTimings(plan)` — menambahkan scene `outro` sintetis dari `plan.outro` (`heading` + `cta` sebagai `text`) di akhir, lalu mengembalikan `TimedScene[]` (`scene`, `from`, `durationInFrames`, `index`).
- `effectiveSeconds(plan)` — durasi final dalam detik, satu desimal.
- `audioSecondsFor(plan)` — total detik audio semua scene.
- `TEMPLATE_LABELS` — label Bahasa Indonesia untuk UI (`hook` → "Hook", `bullets` → "Poin", `stat` → "Angka", `quote` → "Kutipan", `statement` → "Pernyataan", `outro` → "Penutup").

Aturan durasi:

**Tanpa narasi** (tidak ada `scene.audio`, mis. `withNarration: false` atau TTS gagal total):

```
outro  = max(round(2.6 * FPS), round(targetSeconds * FPS * 0.12))
total  = round(targetSeconds * FPS)
isi    = total - outro, dibagi menurut weight (dijepit 0.4–3)
sisa pembulatan dibagikan ke scene dengan pecahan terbesar
```

**Dengan narasi** (minimal satu scene punya audio):

```
scene ber-audio : round((audio.seconds + 0.35) * FPS)
scene tanpa audio: round(2.8 * FPS)
outro           : max(round(2.6 * FPS), round(total_isi * 0.08))
```

Konstanta `AUDIO_TAIL_SECONDS = 0.35`, `SILENT_SCENE_SECONDS = 2.8`, `OUTRO_MIN_SECONDS = 2.6`. Konsekuensinya `targetSeconds` tidak lagi mengikat durasi final saat narasi aktif.

### `src/lib/plan/normalize.ts` — lapisan toleransi

Model bahasa sering mengembalikan kunci berbeda atau teks kepanjangan. `normalizePlan` merapikan sebelum validasi ketat:

- Menerima alias kunci: `title` → `heading`, `subtitle` → `subheading`, `points` → `bullets`, `stat`/`number` → `value`, `body` → `text`, `voiceover` → `narration`, `blocks` → `scenes`, `cta`/`text` → `outro`, `tags` → `hashtags`, `music` → `musicMood`.
- Memotong teks ke batas skema, merapikan spasi, membuang string kosong.
- `template` tak dikenal jatuh ke `statement`; scene tanpa isi apa pun dibuang.
- Mengisi field wajib per template (`bullets` tanpa bullet, `stat` tanpa `value`, `quote` tanpa kutipan, `hook` tanpa heading).
- **Mengisi `narration` dari teks layar** bila AI lupa atau narasi < 12 karakter, supaya tidak ada scene yang diam tanpa alasan.
- Bila tidak ada scene tersisa, dibuat satu scene `hook` dari `plan.hook` atau `fallbackHook`.
- `styleId` dari AI hanya dipakai bila termasuk `STYLE_IDS`; kalau tidak, memakai gaya pilihan pengguna. `targetSeconds` dijepit 15–180.
- Validasi akhir lewat `planSchema.safeParse`; kegagalan melempar `PlanValidationError` berisi maksimal lima issue.

### `src/lib/audio/tts.ts` — narasi suara

Memakai `msedge-tts` (Edge TTS Microsoft, tanpa API key):

| Bagian | Detail |
| --- | --- |
| `TTS_VOICES` | `male` → `id-ID-ArdiNeural`, `female` → `id-ID-GadisNeural` |
| `attachNarration(plan, projectId, options)` | Menyintesis satu MP3 per scene, mengembalikan `{ plan, result }` |
| Opsi | `voice` (default suara pria), `rate` (default `-4%`), `pitch` (default `+0Hz`) |
| Format | `AUDIO_24KHZ_48KBITRATE_MONO_MP3` |
| Output | `public/audio/<projectId>/scene-NN.mp3` (NN dua digit, mulai 01), URL publik `/audio/<projectId>/scene-NN.mp3` |
| Durasi | `ffprobe.exe` dari `node_modules/@remotion/compositor-win32-x64-msvc/`, membaca `format=duration` |
| Hasil | `scene.audio = { src, seconds }` (detik dibulatkan 3 desimal) |
| `NarrationResult` | `{ enabled, voice, dir, scenes, totalSeconds, error? }` |
| `removeNarration(projectId)` | `fs.rm` rekursif folder audio, dipanggil saat project dihapus |

Teks yang diucapkan diambil dari `scene.narration`; bila kosong, fallback ke `heading`, `quote`, `text`, `label`. `cleanForSpeech` mengganti pemisah `·`/`•` dengan koma dan membuang tanda kutip. Scene dilewati bila teks < 3 karakter, buffer < 1200 byte, atau durasi <= 0,2 detik. Kegagalan satu scene hanya dicatat di `result.error`; scene itu dirender tanpa audio dan proses lanjut.

### `src/lib/ai/router.ts` — klien 9Router

- `getRouterConfig()` membaca `NINE_ROUTER_BASE_URL` (default `http://127.0.0.1:20128/v1`, trailing slash dipangkas), `NINE_ROUTER_API_KEY`, `NINE_ROUTER_MODEL` (default `d/standar`), `NINE_ROUTER_FALLBACK_MODEL` (default `infer/cb/deepseek-v4.1-flash`).
- `chatCompletion()` mengirim satu request non-streaming (`temperature` default 0.7, `max_tokens` 6000, timeout 180 detik via `AbortController`). Error dipetakan ke `RouterError` dengan `status` dan potongan body (500 karakter) sebagai `detail`.
- `listModels()` memanggil `GET {baseUrl}/models` dan mengembalikan daftar id, dipakai endpoint health.

### `src/lib/ai/generate.ts` — orkestrasi generasi

- `SYSTEM_PROMPT` menetapkan peran, aturan narasi (12–22 kata, bahasa lisan), aturan teks layar (heading maks 6 kata, **bukan salinan narasi**), aturan angka (diucapkan dengan huruf, ditampilkan sebagai angka), struktur adegan, skema JSON, dan panduan jumlah scene per durasi. Daftar `styleId` di prompt harus ikut diperbarui saat menambah gaya.
- `modelsToTry(requested)` menyusun rantai unik: model yang diminta UI → `NINE_ROUTER_MODEL` → `NINE_ROUTER_FALLBACK_MODEL`.
- `generatePlan()` mencoba setiap model dua kali (percobaan kedua `temperature` 0.3). Setiap percobaan: panggil model → `extractJson` → `normalizePlan`. Bila semua gagal, melempar `PlanValidationError` dengan pesan model terakhir.
- `extractJson()` menerima JSON polos, JSON di dalam code fence, objek pertama di antara `{...}`, atau array yang dibungkus menjadi `{ scenes: [...] }`.
- `GenerateOutcome` membawa `plan`, `model`, `fellBack`, dan `log` berisi jejak tiap percobaan.

### `src/lib/projects/store.ts` — penyimpanan project

- Direktori: `data/projects`, dibuat otomatis (`mkdir recursive`).
- Satu project = satu file `<uuid>.json` (indentasi 2 spasi).
- `isSafeId` membatasi id ke `[a-zA-Z0-9-]{1,64}` untuk mencegah path traversal.
- `listProjects()` membaca semua `*.json`, mengabaikan file rusak, mengurutkan `createdAt` menurun, lalu membuang `plan` dan menambahkan `planTitle` + `sceneCount` (bentuk `ProjectSummary`).
- `getProject`, `saveProject`, `deleteProject`, `createProjectId` (`randomUUID`).

### Route handler (`src/app/api/**`)

Semua route memakai `runtime = "nodejs"`. Route yang membaca disk memakai `dynamic = "force-dynamic"`. Detail kontrak ada di [Kontrak API](#kontrak-api).

`next.config.ts` memakai `cacheComponents: false` dan hanya mengatur loader Tailwind lewat Turbopack. Tidak ada caching komponen karena state aplikasi berubah di luar siklus React (file project, folder audio, status job).

### `src/lib/render/jobs.ts` — job render

- Map job disimpan di `globalThis.__renderJobs` agar tidak hilang saat hot reload di dev (tetap hilang saat proses server mati).
- Batas paralel: `MAX_CONCURRENT = 2`. `startRender` membuat job berstatus `queued`, menulis props, lalu menunggu slot. Selama jumlah job `queued` + `rendering` masih di atas 2, job menunggu dalam polling 700 ms; bila menunggu lebih dari 10 menit, job diubah ke `error` dengan pesan `Antrean render terlalu panjang, coba lagi nanti`.
- `startRender(projectId)`:
  1. Ambil project; gagal bila tidak ada.
  2. Siapkan `public/renders` dan `data/props`.
  3. Tulis props ke `data/props/<jobId>.json` berisi `{ plan }` — termasuk `scene.audio` dan `plan.music` bila ada.
  4. Tunggu slot render.
  5. Spawn `node node_modules/@remotion/cli/remotion-cli.js render remotion/index.ts ShortVideo <out.mp4> --props=<file> --codec=h264 --crf=18 --concurrency=4 --log=info --overwrite` dengan `windowsHide: true` dan `NODE_ENV=production`.
  6. Status `queued` → `rendering` → `done`/`error`, setiap perubahan ditulis balik ke `project.renders` lewat `updateProjectRender`.
- **Pembersihan props:** file `data/props/<jobId>.json` dihapus (`fs.rm`) pada callback `close` dan `error` proses CLI.
- Progres dihitung dari stdout/stderr: baris `Rendered x/y` memetakan ke 0–94, `Encoded x/y` ke 94–99, selesai = 100. Log disimpan maksimal 120 baris.
- Nama file: `<projectId>-<Date.now()>.mp4`; URL publik `/api/files/<nama-file>`.

### `src/lib/files/serve.ts` — penyajian file dari `public/`

- `next start` menyusun manifest `public/` saat server dijalankan, sehingga MP4 hasil render dan MP3 narasi yang dibuat **setelah** server hidup akan 404 bila diakses lewat path statis (`/renders/...`). Route handler membaca disk setiap permintaan sehingga tidak terpengaruh.
- `servePublicFile(request, segments, { cacheSeconds })`:
  - menolak path yang mengandung `..` atau keluar dari `public/`;
  - `fs.stat` untuk memastikan file ada dan mendapat ukuran;
  - mendukung header `Range` → `206` dengan `Content-Range`/`Accept-Ranges` (dibutuhkan `<video>` untuk seek), rentang tidak valid → `416`;
  - tanpa `Range` → `200` dengan `Content-Length`;
  - `Content-Type` dipetakan dari ekstensi (`mp4`, `webm`, `mp3`, `wav`, `png`, `jpg`, `json`).
- Dua route memakainya: `GET /api/files/[name]` (folder `public/renders`, cache 1 tahun) dan `GET /api/audio/[...path]` (folder `public/audio`).
- `ShortVideo` memilih sumber audio lewat `sceneAudioSrc()`: saat render CLI memakai `staticFile()` (membaca `public/`), saat Player di browser memakai `/api/audio/...` — karena file narasi tidak ada di manifest statis.
- `projects/store.ts` memigrasi URL lama `/renders/<file>` menjadi `/api/files/<file>` saat project dibaca, sehingga project yang dibuat sebelum perubahan ini tetap bisa diputar.

### `src/video/**` — komposisi Remotion

- `remotion/index.ts` adalah entry CLI: `registerRoot(RemotionRoot)` dari `src/video/Root.tsx`. Folder `remotion/` hanya berisi file itu.
- `src/video/Root.tsx` mendaftarkan satu komposisi `ShortVideo` dengan `durationInFrames` awal dari `SAMPLE_PLAN`, serta `calculateMetadata` yang menghitung ulang `durationInFrames`, `fps`, `width`, `height` dari `props.plan` — inilah yang membuat render mengikuti durasi project (termasuk durasi audio), bukan durasi contoh.
- `src/video/ShortVideo.tsx` menyusun lapisan, dari bawah ke atas:
  1. `World` — latar bergerak, memakai frame global.
  2. `CaptionScrim` — gradien 620px di bawah supaya caption tetap terbaca.
  3. `<Sequence>` per `TimedScene` → `SceneSlot` (kamera + fade + komponen scene).
  4. `CaptionLayer` — caption terbakar.
  5. `ProgressBar` — garis progres 7px.
  6. `<Audio>` per scene ber-`audio`, diposisikan tepat di `from` scene.
  7. `MusicBed` — hanya bila `plan.music` diisi (fade in 30 frame ke volume 0.14, fade out 45 frame terakhir).
- `SceneSlot` menerapkan `cameraMove(frame, durationInFrames, index, index === 0 ? 1 : 0.75)` pada konten dan `Math.min(enterFade(...), exitFade(...))` dengan durasi fade 9 frame (dibatasi minimal 1 dan maksimal sepertiga durasi scene, sehingga scene pendek tidak habis oleh fade). Latar tidak ikut di-fade.
- `src/video/world.tsx` — latar "dunia": gradient `bgFrom → bgTo`, tiga blob radial dengan blur 90–110px yang bergerak dengan laju berbeda (satu sumbu linear + satu sinus), grid 96px yang bergeser (`frame * 0.35 % 96`), sapuan cahaya diagonal, vignette radial, dan grain dari SVG `feTurbulence` (data URL) yang bergeser tiap frame. `mixBlendMode` grain mengikuti `lightSurface`.
- `src/video/anim.ts` — helper murni: `clamp01`, `easeOutCubic`, `easeInOutCubic`, `fadeUp`, `springIn`, `typewriter`, `kenBurns`, `enterFade`, `exitFade`, `cameraMove`, `countUp`, `words`, `revealWords`. `cameraMove` memakai campuran easing dan linear dengan porsi linear 0.34 (`tail`) supaya kecepatan tidak berhenti di akhir; arah zoom/geser divariasikan dari `seed % 3`. `revealWords` memberi stagger 3 frame per kata.
- `src/video/captions.tsx` — `buildCaptionChunks(narration, from, durationInFrames)` memecah teks menjadi potongan maksimal 3 kata / 22 karakter, lalu membagi durasi menurut panjang teks (minimal 6 frame per potongan, 2 frame per kata). `CaptionLayer` menampilkan satu potongan aktif, kata yang sedang berjalan diberi `captionHighlight` + skala 1.06 + geser 8px; posisinya `bottom: SAFE.captionBottom`, lebar maksimum `SAFE.captionWidth`, ukuran 56px, uppercase. `CaptionScrim` memberi gradien gelap/terang sesuai `lightSurface`.
- `src/video/typography.ts` — `WRAP` dan `fitSize(text, tiers, fallback)`.
- `src/video/scenes/` — `types.ts` (`SceneProps`: `scene`, `design`, `styleId`, `frame` relatif, `durationInFrames`, `isLast`, `index`), `shell.tsx` (`SceneShell`, `Kicker`, `AccentRule`, `scenePadding`), enam komponen (`HookScene`, `BulletsScene`, `StatScene`, `QuoteScene`, `StatementScene`, `OutroScene`), dan `index.ts` (`SCENE_COMPONENTS: Record<SceneTemplate, SceneComponent>`). `ShortVideo` memakai `statement` sebagai cadangan bila kunci tidak ada.
- `SceneShell` menerapkan padding `${SAFE.top + 28}px ${SAFE.left}px ${1920 - SAFE.contentBottom}px` (240 / 88 / 540), jadi area konten efektif 240–1380 dan tidak menyentuh caption.
- `src/video/sample-plan.ts` adalah `VideoPlan` contoh tanpa audio untuk default props dan uji cepat di Remotion Studio.

### `src/app/page.tsx` dan `src/components/studio/`

Lapisan tampilan: `page.tsx` hanya merender `<StudioApp />`. `StudioApp` memegang state form, project aktif, riwayat, health, dan status render; komponen lain memecah tanggung jawab:

| File | Peran |
| --- | --- |
| `studio-app.tsx` | Orkestrasi state, panggilan API, polling job render, isian "Model AI" (`data-testid="input-model"`, datalist `MODEL_SUGGESTIONS`), pemilih suara (`data-testid="input-voice"`: `male` / `female` / `off`), dan badge `suara aktif` (`data-testid="narration-badge"`) |
| `api.ts` | Klien fetch untuk semua endpoint + tipe respons (`GenerateInput` memuat `voice` dan `withNarration`) |
| `player-preview.tsx` | `<Player>` 9:16 (dynamic import, `ssr: false`), memakai prop `acknowledgeRemotionLicense` untuk mematikan warning lisensi di konsol |
| `history-panel.tsx` | Riwayat project; judul menampilkan jumlah, mis. `Project tersimpan (2)` |
| `plan-panel.tsx` | Detail rencana, narasi per scene, caption, hashtag, durasi efektif |
| `render-panel.tsx` | Tombol render, progres, log, unduh |
| `style-picker.tsx` | Pemilih gaya dari `STYLE_LIST` |
| `banners.tsx`, `icons.tsx`, `format.ts`, `cn.ts` | Potongan UI dan util |

Komponen UI memakai data yang sudah divalidasi server; tidak ada panggilan 9Router maupun TTS dari browser.

### `tests/` dan `scripts/`

- Test memakai Vitest dengan konfigurasi `vitest.config.mts` (environment `node`, alias `@` → `src`, timeout 30 detik). Empat file: `normalize.test.ts`, `timing.test.ts`, `extract-json.test.ts`, `generate-route.test.ts` — total 17 test.
- `generate-route.test.ts` meng-import route handler Next.js langsung dan men-stub `fetch` global, jadi tidak butuh server maupun 9Router. Karena route asli dipanggil, `attachNarration` tetap berjalan dan test bisa mencoba Edge TTS; kegagalan TTS tidak menggagalkan test karena scene disimpan tanpa audio.
- `scripts/verify-api.mjs` — E2E lewat HTTP: health → generate (AI nyata) → render → polling → cetak `url` dan path file.
- `scripts/test-narration.mjs` — generate dengan `voice: "male"` dan `withNarration: true`, mencetak `narration` serta durasi audio per scene. Membaca env `BASE`.
- `scripts/render-one.mjs <projectId>` — render satu project, pantau sampai `done`/`error` (batas 20 menit).
- `scripts/dump-props.mjs` — menulis `out/props-check.json` dari project terbaru (root path hardcoded).
- `scripts/check-audio.mjs <file.mp4>` — memakai `ffmpeg.exe` bawaan Remotion untuk mengecek RMS/peak 12 detik pertama.

## Alasan desain

**Font di-bundle, bukan font sistem.** Versi sebelumnya memakai Segoe UI/Georgia supaya tidak ada unduhan saat render. Akibatnya layout bergeser antar mesin: Segoe UI tidak ada di macOS/Linux, dan metrik Georgia berbeda dari Times New Roman. `@remotion/google-fonts` menyelesaikan dua masalah sekaligus: file font ikut bundle (deterministik, OFL), dan `loadFont()` menahan render sampai font siap sehingga frame pertama tidak memakai fallback. Konsekuensi kecil: Anton hanya punya weight 400, jadi `displayWeight`/`displayLineHeight` menyesuaikan alih-alih memaksa 800.

**Safe zone dari UI platform, bukan tebakan.** Angka `SAFE` diambil dari pengukuran UI TikTok/Reels (nilai terketat): UI atas sampai y=212, kolom tombol kanan mulai x=927, area caption platform mulai y=1726. Tanpa ini, teks penting bisa tertutup tombol like/komentar atau judul video. Semua scene memakai `SceneShell` supaya aturan ini tidak bergantung pada disiplin penulis scene.

**Caption mengikuti narasi, bukan headline.** Caption dan headline tampil bersamaan. Kalau caption menyalin headline, layar menampilkan teks yang sama dua kali dan terasa seperti subtitle rusak. Karena itu `captionTextFor` memprioritaskan `scene.narration`, dan prompt melarang heading menyalin narasi.

**Durasi mengikuti audio.** Kalimat yang dipotong di tengah terdengar lebih buruk daripada video yang 3 detik lebih panjang dari target. Karena itu `timing.ts` memakai durasi MP3 + 0,35 detik per scene saat narasi ada, dan hanya membagi `weight` ketika tidak ada audio. Ini keputusan sadar: `targetSeconds` menjadi acuan struktur, bukan kontrak durasi.

**Latar di luar fade.** `World` dirender di luar `<Sequence>`, jadi tidak ikut crossfade. Kalau latar ikut memudar, mata membaca "frame jadi gelap lalu terang" alih-alih transisi antar scene. Yang di-fade hanya konten (kamera + opacity), sehingga video terasa seperti satu take panjang dengan potongan halus.

**Kamera bergerak kontinu.** Scene statis terbaca sebagai slide presentasi. `cameraMove` memberi zoom 1→1.07 dan geser maksimal ±16px, dengan porsi linear 0.34 supaya gerakan tidak berhenti tepat di akhir scene (berhenti mendadak terbaca sebagai "patah"). Arah divariasikan per indeks scene agar cut terasa disengaja.

**AI mengisi JSON, bukan menulis TSX.** Kalau model boleh menghasilkan komponen React, server harus mengeksekusi kode dari jaringan: risiko eksekusi kode, dependensi tak terduga, dan hasil yang tidak bisa direproduksi. Dengan skema zod, keluaran AI hanya data: bisa divalidasi, disimpan, ditampilkan ulang, dan dirender berkali-kali dengan hasil sama.

**Satu komposisi `ShortVideo`.** Preview dan hasil akhir memakai komponen yang sama; tidak ada dua implementasi yang bisa menyimpang. `calculateMetadata` membuat durasi komposisi mengikuti props, sehingga satu komposisi melayani semua durasi 15–180 detik plus variasi durasi audio.

**File JSON tanpa database.** Satu project satu file membuat debugging mudah (`cat data/projects/<id>.json`), tidak perlu service tambahan, dan tidak ada migrasi skema. Konsekuensinya sistem ini dirancang untuk satu instance lokal, bukan deployment multi-instance.

**Normalisasi sebelum validasi.** Model bahasa adalah sumber input yang tidak deterministik. Merapikan alias kunci dan memotong teks lebih murah daripada mengulang panggilan AI, dan validasi zod tetap menjadi gerbang terakhir.

**`cacheComponents: false`.** Aplikasi ini selalu membaca state lokal (`data/projects/`, `data/props/`, `public/renders/`, `public/audio/`) dan memanggil 9Router pada setiap permintaan. Data itu berubah di luar siklus hidup React/Next, jadi komponen yang di-cache akan menampilkan project atau status render yang basi.

**Import relatif di `src/video/**`.** Bundler Remotion tidak membaca alias `paths` dari `tsconfig.json`, jadi `@/lib/...` akan gagal di-resolve saat render meskipun lolos type-check dan jalan di Next.js. Aturan praktisnya: di dalam `src/video/**` selalu pakai path relatif (`../lib/...`, `../../lib/...`, `../anim`, `../design`). Alias `@/` hanya dipakai di `src/app`, `src/components`, `src/lib`, dan `tests/`.

**Tipografi defensif.** Panjang teks dari AI tidak bisa dijamin oleh prompt. `WRAP` mencegah kata panjang melewati kanvas 1080px, `fitSize` memilih ukuran font dari panjang teks, dan `SceneShell` membatasi area. Untuk daftar (bullets) tinggi blok dikendalikan dengan ukuran font per item, bukan `transform: scale` pada seluruh blok.

**Antrean render 2 paralel.** Setiap render men-spawn proses Chrome + encoder yang berat. Membiarkan permintaan render tak terbatas akan menghabiskan CPU/RAM dan membuat semua job saling memperlambat. Dua slot memberi hasil yang wajar di mesin pengembang, sementara sisanya menunggu dengan batas 10 menit agar antrean tidak menggantung selamanya.

**TTS tanpa API key.** Edge TTS dipilih karena tidak butuh kredensial dan punya suara Indonesia yang wajar. Risikonya adalah ketergantungan jaringan dan ketiadaan SLA; karena itu kegagalan TTS diperlakukan sebagai degradasi (video tanpa suara), bukan error yang membatalkan generate.

## Kontrak API

Semua respons berformat JSON. Tidak ada autentikasi; aplikasi diasumsikan berjalan lokal.

### `POST /api/generate`

Menghasilkan `VideoPlan` dari deskripsi, menyintesis narasi (opsional), dan menyimpannya sebagai project baru.

Body:

```json
{
  "description": "Tiga kebiasaan pagi yang bikin fokus seharian",
  "targetSeconds": 30,
  "styleId": "cinematic",
  "model": "d/standar",
  "voice": "male",
  "withNarration": true
}
```

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `description` | Ya | 10–2000 karakter |
| `targetSeconds` | Ya | Bilangan bulat 15–180 |
| `styleId` | Ya | Salah satu `STYLE_IDS` |
| `model` | Tidak | Bila diisi, model itu dicoba lebih dulu |
| `voice` | Tidak | `"male"` (Ardi, default) atau `"female"` (Gadis) |
| `withNarration` | Tidak | Default aktif. `false` = lewati TTS sepenuhnya |

Respons `200`:

```json
{
  "project": { "id": "...", "plan": { "...": "..." }, "narration": { "...": "..." }, "renders": [] },
  "plan": { "...": "..." },
  "model": "d/standar",
  "fellBack": false,
  "narration": {
    "enabled": true,
    "voice": "id-ID-ArdiNeural",
    "scenes": 5,
    "totalSeconds": 42.318
  },
  "log": ["d/standar: berhasil (percobaan 1)"]
}
```

Field `narration` tidak ada pada respons bila `withNarration: false` (nilainya `undefined`, sehingga kunci dihilangkan dari JSON). Bila TTS gagal seluruhnya, `enabled` bernilai `false` dan `error` berisi pesan terakhir. `project.narration` menyimpan objek yang sama.

| Kode | Body | Penyebab |
| --- | --- | --- |
| `400` | `{ "error": "Body harus JSON" }` | Body tidak bisa di-parse |
| `400` | `{ "error": "Input tidak valid", "issues": [{ "path": "description", "message": "..." }] }` | Gagal `generateRequestSchema` |
| `502` | `{ "error": "...", "detail": "..." }` | Semua model gagal, atau `PlanValidationError` |

`runtime = "nodejs"`, `maxDuration = 300`. Narasi disintesis berurutan per scene, jadi waktu respons ikut panjang total audio.

### `GET /api/health`

Mengecek koneksi 9Router dan ketersediaan model yang dikonfigurasi.

Respons `200`:

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:20128/v1",
  "model": "d/standar",
  "fallbackModel": "infer/cb/deepseek-v4.1-flash",
  "modelAvailable": true,
  "fallbackAvailable": true,
  "totalModels": 12
}
```

| Kode | Body | Penyebab |
| --- | --- | --- |
| `503` | `{ "ok": false, "baseUrl": "...", "model": "...", "error": "..." }` | `GET /models` gagal (9Router mati / key ditolak) |

`dynamic = "force-dynamic"` supaya status selalu dibaca ulang. Endpoint ini tidak memeriksa ketersediaan TTS.

### `GET /api/projects`

Respons `200`: `{ "projects": ProjectSummary[] }` — tiap item adalah `Project` tanpa `plan`, ditambah `planTitle` dan `sceneCount`, diurutkan dari yang terbaru.

### `GET /api/projects/[id]`

Respons `200`: `{ "project": Project }`. `404` bila tidak ada: `{ "error": "Project tidak ditemukan" }`.

### `DELETE /api/projects/[id]`

Menghapus file JSON project, semua file MP4 yang tercatat di `project.renders` (`public/renders/<nama-file>`), dan folder audio `public/audio/<id>/` lewat `removeNarration`. Nama file render diambil dari `render.url` lalu dibatasi ke `path.basename` sebelum dihapus, sehingga hanya file di folder render yang tersentuh. Respons `200`: `{ "ok": true }`. `404` bila tidak ada: `{ "error": "Project tidak ditemukan" }`.

### `POST /api/render`

Memulai job render untuk project yang sudah ada.

Body: `{ "projectId": "..." }`

Respons `200`:

```json
{
  "job": {
    "id": "...",
    "projectId": "...",
    "status": "rendering",
    "progress": 1,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "logs": []
  }
}
```

`startRender` menunggu slot sebelum membalas, jadi respons normal sudah berstatus `rendering`. Status `queued` terlihat lewat `GET /api/render/<jobId>` selama job masih menunggu slot (maksimal 2 job berjalan bersamaan).

| Kode | Body | Penyebab |
| --- | --- | --- |
| `400` | `{ "error": "Body harus JSON" }` | Body tidak bisa di-parse |
| `400` | `{ "error": "projectId wajib diisi" }` | Gagal `renderRequestSchema` |
| `500` | `{ "error": "Project <id> tidak ditemukan" }` | Project tidak ada / spawn gagal |

`maxDuration = 900`. Job berjalan asinkron; route ini langsung membalas.

### `GET /api/render/[jobId]`

Respons `200`: `{ "job": RenderJob }` dengan field `status` (`queued` | `rendering` | `done` | `error`), `progress` (0–100), `message?`, `url?` (`/api/files/...`), `file?` (path absolut), `finishedAt?`, `logs[]`. `404`: `{ "error": "Job render tidak ditemukan" }`.

Tidak ada endpoint untuk membatalkan job atau mendaftar semua job.

### `GET /api/files/[name]`

Menyajikan `public/renders/<name>` dari disk (bukan aset statis), dengan `Range` → `206` dan `Cache-Control: public, max-age=31536000, immutable`. `400` bila nama tidak valid, `404` bila file tidak ada. Dipakai `RenderJob.url`.

### `GET /api/audio/[...path]`

Menyajikan `public/audio/<path>` dengan perilaku sama seperti `/api/files`. Dipakai Player di browser; saat render CLI, audio dibaca lewat `staticFile()`.

## Menambah gaya visual baru

1. `src/lib/plan/schema.ts` — tambahkan id ke `STYLE_IDS` (mis. `"pastel"`). Ini memperbarui `StyleId`, `planSchema`, dan `generateRequestSchema` sekaligus.
2. `src/lib/plan/styles.ts` — tambahkan entri di `STYLE_TOKENS` dengan **semua** field `StyleTokens`. `STYLE_LIST`, pemilih gaya, riwayat, dan panel rencana ikut terisi tanpa perubahan lain.
3. `src/video/design.ts` — tambahkan entri di `DESIGNS` dengan **semua** field `Design` (`bgFrom`, `bgTo`, `blobs`, `grid`, `gridOpacity`, `text`, `textMuted`, `accent`, `accent2`, `card`, `cardBorder`, `display`, `body`, `uppercase`, `tracking`, `radius`, `captionText`, `captionHighlight`, `captionOutline`, `grain`, `vignette`, `glow`, `gridOn`, `lightSurface`). Karena bertipe `Record<StyleId, Design>`, TypeScript akan menolak build bila ada field yang lupa.
4. `src/lib/ai/generate.ts` — perbarui daftar nilai `styleId` pada `SYSTEM_PROMPT` agar AI tahu gaya baru tersedia.
5. Tidak perlu menyentuh `normalize.ts` atau `timing.ts`: `styleId` tak dikenal sudah jatuh ke gaya pilihan pengguna, dan timing tidak bergantung pada gaya.

Verifikasi cepat: `npm run build` (record wajib lengkap), generate project dengan gaya baru, cek `plan.styleId` pada respons, lalu bandingkan preview dan hasil render. Perhatikan `lightSurface`: gaya terang perlu `true` agar bayangan kartu dan outline caption tidak terlihat seperti stiker.

## Menambah template scene baru

1. `src/lib/plan/schema.ts` — tambahkan id ke `SCENE_TEMPLATES` (mis. `"timeline"`). Ini memperbarui `SceneTemplate` dan enum `template`.
2. `src/video/scenes/<nama>.tsx` — buat komponen bertipe `SceneComponent` (props `SceneProps`). Pakai `design` untuk warna/font, dan `frame`/`durationInFrames` untuk animasi lokal; jangan membaca `useCurrentFrame()` global agar animasi tetap relatif terhadap scene.
3. **Import di file scene harus path relatif**, mis. `import { FPS } from "../../lib/plan/schema"`, `import { WRAP, fitSize } from "../typography"`, `import { cameraMove } from "../anim"`. Alias `@/` tidak di-resolve bundler Remotion dan baru ketahuan gagal saat render.
4. **Teks wajib memakai `WRAP` dan `fitSize`**, dan bungkus konten dengan `SceneShell` supaya berada di dalam `SAFE`. Pilih ukuran font lewat `fitSize(text, tiers, fallback)`; untuk teks display pakai `displayWeight(design)` dan `displayLineHeight(design)`.
5. `src/video/scenes/index.ts` — daftarkan komponen di `SCENE_COMPONENTS` (`Record<SceneTemplate, SceneComponent>`). Tipe record memastikan tidak ada template yang lupa diisi.
6. `src/lib/plan/timing.ts` — tambahkan label di `TEMPLATE_LABELS` (dipakai UI).
7. `src/lib/plan/normalize.ts` — tambahkan penanganan field wajib template baru di `sanitizeScene` (mis. isi `value` default) supaya scene tidak terbuang saat AI mengirim field kosong. Ingat juga aturan "scene tanpa isi dibuang" di fungsi itu.
8. `src/lib/ai/generate.ts` — tambahkan contoh JSON template baru di `SYSTEM_PROMPT`.

Verifikasi: `npm test` tetap lulus, `npm run build` sukses (record `SCENE_COMPONENTS` wajib lengkap), lalu render satu project yang memakai template tersebut dan periksa hasilnya di pemutar video. Cek juga bahwa caption (yang diambil dari `narration`) tidak menutupi elemen utama scene baru.

## Batasan

- **Tanpa musik bawaan.** `plan.music` sudah didukung `ShortVideo` (fade in/out, volume 0.14), tetapi repo tidak menyertakan file musik karena lisensinya tidak jelas. Selama `plan.music` kosong, MP4 hanya berisi narasi (atau tanpa audio sama sekali bila TTS juga gagal). Menambahkan musik berarti menyiapkan file berlisensi di `public/` dan mengisinya di rencana.
- **Job render disimpan di memori.** Status job ada di `globalThis` dan hilang saat server restart; project, audio, dan file MP4 tetap ada di disk. Render yang sedang berjalan ikut terputus.
- **TTS butuh internet.** `msedge-tts` memanggil layanan Microsoft. Tanpa koneksi, narasi gagal dan video dirender tanpa suara; generate tetap sukses.
- **Pembacaan durasi audio khusus Windows.** `tts.ts` menunjuk `node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe`. Di OS lain file itu tidak ada, `probeSeconds` mengembalikan 0, dan scene dilewati tanpa audio.
- **Tanpa aset eksternal.** Tidak ada gambar, video, atau footage; visual murni teks, bentuk, gradien, dan CSS. Prompt AI melarang adegan yang butuh rekaman kamera.
- **Satu instance karena penyimpanan file.** Project, props, audio, dan hasil render adalah file di disk lokal; tidak ada database atau object storage bersama. Dua proses server yang menunjuk folder sama bisa saling menimpa, dan deployment multi-instance/serverless tidak didukung.
- **Tanpa autentikasi.** Semua orang yang bisa membuka server bisa membaca, menghapus project (termasuk MP4 dan audio), dan memicu render.
- **Tidak ada pembatalan render.** Proses CLI yang sudah jalan hanya berhenti bila proses server dimatikan.
- **Pembersihan props bergantung pada callback proses.** `data/props/<jobId>.json` dihapus saat proses CLI `close`/`error`. Kalau server dimatikan di tengah render, file bisa tertinggal dan perlu dibersihkan manual.
- **Antrean render terbatas.** Maksimal 2 render paralel; job yang menunggu lebih dari 10 menit berubah menjadi `error`.
- **Render butuh lingkungan lokal.** Chrome Headless Shell diunduh pada render pertama (sekitar 131 MB) dan proses `node` harus bisa spawn CLI Remotion; konfigurasi ini tidak dirancang untuk platform serverless.
- **Durasi tidak lagi sama dengan target saat narasi aktif.** `targetSeconds` dibatasi bilangan bulat 15–180, tetapi durasi final = jumlah (audio + 0,35 s) + outro. Tanpa narasi, durasi dibulatkan ke frame 30 fps sehingga bisa berbeda kurang dari 1/30 detik.
- **Caption mengikuti teks, bukan waktu audio asli.** Pembagian durasi caption dihitung dari panjang teks, bukan dari timestamp TTS. Untuk kalimat dengan tempo tidak rata, highlight kata bisa sedikit mendahului atau tertinggal dari suara.
- **Lisensi Remotion.** Prop `acknowledgeRemotionLicense` pada `<Player>` hanya mematikan warning di konsol, bukan memberi hak lisensi komersial. Untuk pemakaian komersial, ikuti ketentuan lisensi Remotion.
