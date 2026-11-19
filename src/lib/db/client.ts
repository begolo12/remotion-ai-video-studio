import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env, requireEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

declare global {
  var __remotionDbPool: Pool | undefined;
  var __remotionDbClient: Database | undefined;
}

const isLocalConnection = (connectionString: string): boolean =>
  /localhost|127\.0\.0\.1|\[::1\]/.test(connectionString);

function getPool(): Pool {
  requireEnv("databaseUrl");
  if (!globalThis.__remotionDbPool) {
    const connectionString = env.databaseUrl;
    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: isLocalConnection(connectionString) ? undefined : { rejectUnauthorized: false },
    });
    attachDatabasePool(pool);
    globalThis.__remotionDbPool = pool;
  }
  return globalThis.__remotionDbPool;
}

function getDb(): Database {
  requireEnv("databaseUrl");
  if (!globalThis.__remotionDbClient) {
    globalThis.__remotionDbClient = drizzle(getPool(), { schema });
  }
  return globalThis.__remotionDbClient;
}

/**
 * `db` sengaja berupa proxy malas: modul aman di-import tanpa env, dan error
 * baru muncul saat query dipakai. Pool disimpan di globalThis supaya
 * hot-reload tidak membuat koneksi baru tiap kali modul dimuat ulang.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const real = getDb();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function closeDb(): Promise<void> {
  if (globalThis.__remotionDbPool) {
    await globalThis.__remotionDbPool.end();
    globalThis.__remotionDbPool = undefined;
  }
  globalThis.__remotionDbClient = undefined;
}
