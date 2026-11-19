import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env, requireEnv } from "@/lib/env";
import * as schema from "./schema";

/** Jalankan migrasi memakai koneksi langsung (UNPOOLED), bukan pooler. */
export async function runMigrations(): Promise<void> {
  requireEnv("databaseUrlUnpooled");
  const connectionString = env.databaseUrlUnpooled;
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: /localhost|127\.0\.0\.1|\[::1\]/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    await migrate(drizzle(pool, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await pool.end();
  }
}
