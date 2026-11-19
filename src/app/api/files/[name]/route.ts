import { servePublicFile } from "@/lib/files/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `/api/files/<nama>` → `public/renders/<nama>` (video hasil render). */
export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  return servePublicFile(request, ["renders", name], { cacheSeconds: 31_536_000 });
}
