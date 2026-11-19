import { defineConfig } from "drizzle-kit";

/**
 * `generate` hanya butuh schema; koneksi dipakai oleh `runMigrations()`
 * lewat DATABASE_URL_UNPOOLED. Kredensial tidak boleh dituliskan di file ini.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
