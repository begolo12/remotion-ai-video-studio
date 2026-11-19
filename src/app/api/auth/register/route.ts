import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensurePersonalWorkspace } from "@/lib/auth/access";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
});

const SESSION_COOKIE = "session";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Input tidak valid",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const displayName = parsed.data.displayName ?? email.split("@")[0];

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, displayName })
    .returning({ id: users.id, email: users.email, displayName: users.displayName });

  const workspace = await ensurePersonalWorkspace(user.id);
  const session = await createSession(user.id);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });

  return NextResponse.json(
    { user, workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } },
    { status: 201 },
  );
}
