import { servePublicFile } from "@/lib/files/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `/api/audio/<projectId>/<file>` → `public/audio/...`.
 *
 * File narasi dibuat setelah server berjalan, sedangkan `next start` hanya
 * menyajikan `public/` yang ada saat start. Karena itu Player di browser
 * memakai route ini (lihat `sceneAudioSrc`), sementara render CLI tetap
 * memakai path public lewat `staticFile()`.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return servePublicFile(request, ["audio", ...path], { cacheSeconds: 31_536_000 });
}
