import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users, type User } from "@/lib/db/schema";
import { env, requireEnv } from "@/lib/env";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Cookie menyimpan `<token>.<signature>`. Yang disimpan di DB adalah
 * signature (HMAC-SHA256 dari token), sehingga kebocoran DB tidak
 * langsung membocorkan token yang dipakai client.
 */
function sign(token: string): string {
  requireEnv("authSecret");
  return createHmac("sha256", env.authSecret).update(token).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function splitCookie(value: string): { token: string; signature: string } | null {
  const separator = value.indexOf(".");
  if (separator <= 0) return null;
  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!token || !signature) return null;
  return { token, signature };
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const signature = sign(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({ id: signature, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${token}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });

  return { token: `${token}.${signature}`, expiresAt };
}

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const parsed = splitCookie(cookieStore.get(SESSION_COOKIE)?.value ?? "");
  if (!parsed) return null;
  if (!safeEqualHex(parsed.signature, sign(parsed.token))) return null;

  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, parsed.signature))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, parsed.signature));
    return null;
  }

  return row.user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const parsed = splitCookie(cookieStore.get(SESSION_COOKIE)?.value ?? "");
  if (parsed && safeEqualHex(parsed.signature, sign(parsed.token))) {
    await db.delete(sessions).where(eq(sessions.id, parsed.signature));
  }
  cookieStore.delete(SESSION_COOKIE);
}
