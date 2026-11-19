import { servePublicFile } from "@/lib/files/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Menyajikan aset lokal dari STORAGE_DIR, misalnya `/api/local/assets/<file>`. */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return servePublicFile(request, path, { cacheSeconds: 31_536_000 });
}
