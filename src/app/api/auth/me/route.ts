import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensurePersonalWorkspace } from "@/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const workspace = await ensurePersonalWorkspace(user.id);
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
  });
}
