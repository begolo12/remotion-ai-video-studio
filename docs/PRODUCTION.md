# Deployment production

Dokumen ini menjelaskan cara menjalankan Remotion AI Video Studio di GitHub + Vercel dengan Neon Postgres region Singapore dan InferHub.

## Arsitektur

```text
Browser
  │
  ▼
Next.js 16 di Vercel (region sin1)
  ├── Auth + workspace
  ├── Studio UI + Remotion Player
  ├── API routes
  └── Render orchestration
        │
        ├── InferHub .......... cx/gpt-6.2-sol
        ├── Neon Postgres ..... aws-ap-southeast-1
        ├── Storage lokal ..... audio, asset, MP4
        └── Vercel Sandbox .... render Remotion
```

Prinsip penting:

- API key tidak pernah dikirim ke browser.
- Project dan job disimpan di Neon, bukan filesystem Vercel.
- Audio TTS, aset, dan MP4 disimpan di disk lokal (`STORAGE_DIR`). Di Vercel runtime memakai `/tmp`, jadi file tidak persisten antar-instance.
- Render berjalan detached di Vercel Sandbox, lalu di-polling.
- AI hanya menghasilkan JSON; Remotion tidak menjalankan kode dari AI.

## 1. Neon

Buat project Neon dengan region `aws-ap-southeast-1` (Singapore) melalui Vercel Marketplace atau dashboard Neon.

Dua connection string yang diperlukan:

| Variable | Fungsi |
|---|---|
| `DATABASE_URL` | Pooled (`-pooler`), dipakai aplikasi |
| `DATABASE_URL_UNPOOLED` | Direct, dipakai `drizzle-kit migrate` |

Jangan menjalankan migrasi lewat `DATABASE_URL` karena pooled connection tidak mendukung session-level operation.

Jalankan migrasi:

```bash
cmd /c "npx.cmd drizzle-kit generate"
cmd /c "npx.cmd tsx src/lib/db/migrate.ts"
```

## 2. InferHub

Endpoint:

```text
https://api.inferhub.dev/v1
```

Model default:

```text
cx/gpt-6.2-sol
```

Module `src/lib/ai/provider.ts` memakai format OpenAI-compatible `/chat/completions`.

Sebelum produksi, verifikasi kemampuan endpoint:

```bash
curl https://api.inferhub.dev/v1/models \
  -H "Authorization: Bearer $INFERHUB_API_KEY"
```

Jika `response_format` tidak didukung, provider otomatis fallback tanpa mode JSON dan parser tetap membersihkan code fence markdown.

API key wajib diisi hanya di:

- Vercel Dashboard → Project → Settings → Environment Variables
- `.env.local` untuk development

JANGAN pernah memasukkan key ke GitHub, termasuk file `.env.example`.

## 3. Environment variables

Lihat `.env.example` untuk daftar lengkap. Ringkasan wajib:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
INFERHUB_BASE_URL
INFERHUB_MODEL
INFERHUB_API_KEY
AUTH_SECRET
STORAGE_DIR
CRON_SECRET
RENDER_SERVE_URL
```

Generate secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 4. GitHub

Inisialisasi repository dan push:

```bash
git init
git add .
git commit -m "Initial production implementation"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Pastikan `.env.local` tidak masuk commit. `.gitignore` sudah mengabaikan `.env*`.

GitHub Actions di `.github/workflows/ci.yml` menjalankan:

- lint
- typecheck
- unit test
- build

## 5. Vercel

Import repository ke Vercel dengan pengaturan:

| Pengaturan | Nilai |
|---|---|
| Framework | Next.js |
| Region | Singapore (`sin1`) |
| Node version | 24 |

Tambahkan semua environment variable dari `.env.example` ke Environment Variables Production dan Preview.

`vercel.json` sudah mengatur:

- region `sin1`
- `maxDuration` untuk route AI dan render
- cron `/api/cron/recover` harian pukul 00.00 UTC (batas akun Vercel Hobby; upgrade ke Pro untuk interval lebih sering)
- header keamanan dasar

`RENDER_SERVE_URL` harus diisi dengan URL deployment yang dapat diakses publik, karena Vercel Sandbox perlu mengambil bundle Remotion dari URL tersebut.

## 6. Smoke test setelah deploy

1. Buka URL produksi.
2. Daftar akun baru.
3. Buat project dengan prompt singkat.
4. Pastikan storyboard dihasilkan.
5. Edit satu scene, lalu simpan.
6. Pastikan preview berubah.
7. Jalankan render.
8. Cek status job berubah dari `queued` ke `completed`.
9. Unduh MP4.
10. Cek log Vercel tidak ada error sensitif.

## 7. Backup dan recovery

- Neon menyimpan history; gunakan branch untuk rollback.
- `recoverStaleJobs` menandai job yang menggantung sebagai failed agar bisa di-retry.
- Cron terlindungi dengan `CRON_SECRET`.

## 8. Yang belum otomatis

Hal-hal yang masih perlu dilakukan manual:

- Rotate API key yang pernah terekspos.
- Mengisi kuota dan batasan provider di dashboard InferHub.
- Menentukan provider image/video generatif bila diperlukan.
- Meninjau lisensi musik dan aset sebelum publikasi.
