import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

/**
 * Menyajikan file dari `public/` langsung dari disk.
 *
 * `next start` hanya menyajikan file `public/` yang sudah ada saat server
 * dijalankan; MP4 hasil render atau MP3 narasi yang dibuat setelahnya akan
 * 404 bila diakses lewat path statis. Route ini membaca disk tiap permintaan
 * dan mendukung `Range` agar `<video>` bisa seek.
 */
export const servePublicFile = async (
  request: Request,
  segments: string[],
  options: { cacheSeconds?: number } = {},
): Promise<Response> => {
  const relative = segments.join("/");
  if (!relative || relative.includes("..") || relative.startsWith("/")) {
    return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });
  }

  const filePath = path.join(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });
  }

  let size: number;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("bukan file");
    size = stat.size;
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const cache = options.cacheSeconds
    ? `public, max-age=${options.cacheSeconds}, immutable`
    : "public, max-age=0";

  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

    if (!Number.isFinite(start) || start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const stream = Readable.toWeb(
      createReadStream(filePath, { start, end }),
    ) as ReadableStream;

    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": cache,
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": cache,
    },
  });
};
