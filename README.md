# Remotion AI Video Studio

Studio produksi video YouTube Short 9:16 berbasis prompt. User menulis ide, AI membuat storyboard terstruktur, user mengedit tiap scene, lalu Remotion merender MP4 1080×1920.

Arsitektur production:

```text
Next.js 16 (Vercel, Singapore)
  ├── Auth + workspace
  ├── Studio UI + Remotion Player
  ├── Neon Postgres (aws-ap-southeast-1)
  ├── Storage lokal (audio, aset, MP4)
  ├── InferHub (cx/gpt-6.2-sol)
  └── Vercel Sandbox (render Remotion)
```

## Yang sudah ada

- Prompt → AI storyboard berbasis Zod (`VideoPlan` v2), bukan kode TSX bebas.
- Editor storyboard: edit judul, narasi, caption, arahan visual, durasi, kamera, visual; reorder, duplikasi, hapus scene.
- Regenerasi per scene dan quality review oleh AI.
- Revisi project tersimpan di Neon dan bisa dipulihkan lewat revision number.
- Narasi Edge TTS bahasa Indonesia dengan word timing, disimpan di Vercel Blob.
- Caption karaoke, safe zone 9:16, latar bergerak, push-in kamera, 16 ilustrasi SVG.
- Preview memakai komponen Remotion yang sama dengan render.
- Antrean render persisten dengan klaim atomik, retry, cancel, dan recovery cron.
- Auth email/password dengan session HMAC.
- Health check untuk Neon dan InferHub.

## Prasyarat

- Node.js 24.
- Akun Neon dengan region `aws-ap-southeast-1`.
- Project Vercel dengan region `sin1` dan Vercel Blob aktif.
- API key InferHub.

Lihat `docs/PRODUCTION.md` untuk langkah deployment lengkap.

## Instalasi lokal

```bash
npm install
cp .env.example .env.local
# isi .env.local dengan kredensial Anda
npx drizzle-kit migrate
npm run dev
```

Buka `http://localhost:3000`, daftar akun, lalu buat video.

> Jangan pernah memasukkan API key ke repository. Gunakan Environment Variables di Vercel dan `.env.local` secara lokal.

## Environment variables

| Variable | Wajib | Fungsi |
|---|---:|---|
| `DATABASE_URL` | Ya | Pooled Neon connection untuk runtime |
| `DATABASE_URL_UNPOOLED` | Ya | Direct Neon connection untuk migrasi |
| `INFERHUB_BASE_URL` | Ya | Default `https://api.inferhub.dev/v1` |
| `INFERHUB_MODEL` | Ya | Default `cx/gpt-6.2-sol` |
| `INFERHUB_FALLBACK_MODEL` | Tidak | Model cadangan |
| `INFERHUB_API_KEY` | Ya | Server-side saja |
| `AUTH_SECRET` | Ya | HMAC session |
| `STORAGE_DIR` | Tidak | Folder file lokal; default `public/` (dev) atau `/tmp` (Vercel) |
| `CRON_SECRET` | Ya | Melindungi `/api/cron/*` |
| `RENDER_SERVE_URL` | Ya | URL deployment untuk render |
| `REMOTION_BUNDLE_DIR` | Tidak | Default `.remotion/bundle` |

Salin `.env.example` sebagai referensi.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build Next.js + bundle Remotion |
| `npm start` | Production server lokal |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run studio` | Remotion Studio |
| `npm run render:sample` | Render sample MP4 lokal |
| `npx drizzle-kit generate` | Buat migration SQL |
| `npx drizzle-kit migrate` | Jalankan migration |

## Alur data

```text
Prompt user
  → /api/generate
  → InferHub menghasilkan JSON storyboard
  → Zod validasi → VideoPlan v2
  → TTS → MP3 di storage lokal + word timing
  → Neon: project + revision 1
  → UI: Player + editor storyboard
  → PATCH /api/projects/:id/storyboard → revision baru
  → POST /api/projects/:id/review → quality issue
  → POST /api/render → job queued → Vercel Sandbox
  → polling /api/render/:jobId → MP4 di storage lokal
```

## API utama

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/auth/register` | Buat akun |
| POST | `/api/auth/login` | Masuk |
| POST | `/api/auth/logout` | Keluar |
| GET | `/api/auth/me` | Session saat ini |
| GET | `/api/health` | Status Neon + InferHub |
| POST | `/api/generate` | Buat project dari prompt |
| GET | `/api/projects` | Daftar project |
| GET/DELETE | `/api/projects/:id` | Buka/hapus project |
| PATCH | `/api/projects/:id/storyboard` | Simpan revisi storyboard |
| POST | `/api/ai/regenerate` | Regenerasi satu scene |
| POST | `/api/ai/review` | Quality review |
| POST | `/api/render` | Mulai render |
| GET | `/api/render/:jobId` | Status render |
| GET | `/api/cron/recover` | Recovery job (dilindungi `CRON_SECRET`) |

## Keamanan

- API key hanya di server, tidak pernah dikirim ke browser.
- Setiap endpoint project/AI/render memeriksa session dan workspace membership.
- Upload dan download aset memakai URL bertanda tangan.
- Log tidak mengandung credential.
- Cron endpoint memerlukan `CRON_SECRET`.

## Batasan yang perlu diketahui

- Render membutuhkan Vercel Sandbox dan bundle Remotion yang dihasilkan `postbuild`.
- File disimpan lokal. Di Vercel runtime memakai `/tmp`, jadi MP4/audio **tidak persisten antar-request**: render tetap berjalan, tetapi tautan unduh akan 404 setelah invocation berganti. Untuk penggunaan penuh, jalankan aplikasi secara lokal dengan `STORAGE_DIR` mengarah ke folder permanen. Ini adalah pilihan desain yang disepakati: tanpa Vercel Blob maupun penyimpanan objek lain.
- Generator gambar/video belum terhubung; visual memakai ilustrasi SVG bawaan. Ajukan provider jika ingin aset generatif.
- TTS bergantung pada ketersediaan Edge TTS dan jaringan.
- Model `cx/gpt-6.2-sol` harus tersedia di akun InferHub Anda.

## Struktur

```text
src/lib/ai/          Provider InferHub + pipeline kreatif
src/lib/plan/        Schema VideoPlan v1/v2 + migrasi
src/lib/db/          Drizzle schema, client, migrasi
src/lib/auth/        Password, session, akses workspace
src/lib/jobs/        Antrean render persisten
src/lib/render/      Vercel Sandbox + checklist
src/lib/storage/     Storage file lokal (STORAGE_DIR)
src/lib/audio/       TTS cloud
src/lib/projects/    Service project + revisi
src/video/           Komponen Remotion
src/components/      UI studio + editor
src/app/api/         Route handlers
drizzle/             Migration SQL
docs/PRODUCTION.md   Panduan deploy
```
