/**
 * Satu tempat untuk membaca variabel lingkungan server.
 *
 * Nilai dibaca sekali saat modul dimuat. Ini disengaja: konfigurasi bersifat
 * statis per proses (termasuk saat hot-reload Next.js).
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? "",
  inferhubBaseUrl: process.env.INFERHUB_BASE_URL ?? "https://api.inferhub.dev/v1",
  inferhubModel: process.env.INFERHUB_MODEL ?? "cx/gpt-6.2-sol",
  inferhubFallbackModel: process.env.INFERHUB_FALLBACK_MODEL ?? "",
  inferhubApiKey: process.env.INFERHUB_API_KEY ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  storageDir: process.env.STORAGE_DIR ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
};

export type EnvKey = keyof typeof env;

/**
 * Pastikan kunci-kunci penting sudah terisi. Dipanggil di titik pemakaian
 * (bukan saat import) supaya modul tetap bisa dimuat saat env belum ada.
 */
export function requireEnv<K extends EnvKey>(...keys: K[]): void {
  const missing = keys.filter((key) => env[key].trim().length === 0);
  if (missing.length > 0) {
    throw new Error(`Variabel lingkungan belum diisi: ${missing.join(", ")}`);
  }
}
