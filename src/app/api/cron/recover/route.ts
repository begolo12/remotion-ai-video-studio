import { NextResponse } from "next/server";
import { recoverStaleJobs } from "@/lib/jobs/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recovered = await recoverStaleJobs(15 * 60 * 1000);
    return NextResponse.json({ ok: true, recovered });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
