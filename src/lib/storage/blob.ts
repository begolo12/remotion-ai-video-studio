import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Storage file lokal. Nama modul tetap `blob.ts` agar tidak mengubah import
 * di seluruh aplikasi, tetapi tidak ada lagi komunikasi dengan Vercel Blob.
 *
 * Root dapat diubah lewat STORAGE_DIR. Default = `public/` supaya file bisa
 * disajikan oleh route `/api/audio`, `/api/files`, dan `/api/local`.
 */

export type StoredObject = { storageKey: string; url: string; size: number };

const SAFE_EXTENSIONS = new Set([
  "mp4", "webm", "mov", "mp3", "wav", "m4a", "ogg",
  "png", "jpg", "jpeg", "webp", "gif", "svg", "json", "srt", "vtt", "txt", "pdf",
]);

export function storageRoot(): string {
  const configured = process.env.STORAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  // Di Vercel, `public/` bersifat read-only saat runtime; /tmp satu-satunya
  // direktori yang bisa ditulis. File tidak persisten antar-invocation.
  return process.env.VERCEL
    ? path.join(os.tmpdir(), "remotion-storage")
    : path.join(process.cwd(), "public");
}

export function normalizeKey(storageKey: string): string {
  const key = storageKey.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key || key.includes("..") || /\s/.test(key)) {
    throw new Error("storageKey tidak valid");
  }
  return key;
}

const dataSize = (data: Buffer | Uint8Array | ArrayBuffer | string | Blob): number => {
  if (typeof data === "string") return Buffer.byteLength(data, "utf8");
  const like = data as { byteLength?: number; length?: number; size?: number };
  if (typeof like.size === "number") return like.size;
  return like.byteLength ?? like.length ?? 0;
};

const safeExtension = (filename: string): string => {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (!ext || !SAFE_EXTENSIONS.has(ext)) {
    throw new Error(`Ekstensi file "${filename}" tidak didukung`);
  }
  return ext;
};

const safeSegments = (filename: string): string[] =>
  filename
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80));

/** Tulis file ke disk lokal dengan nama acak, mempertahankan folder induk. */
export async function putObject(input: {
  data: Buffer | Uint8Array | ArrayBuffer | string | Blob;
  filename: string;
  contentType?: string;
  access?: "public" | "private";
}): Promise<StoredObject> {
  if (typeof input.filename !== "string" || input.filename.length === 0) {
    throw new Error("filename wajib diisi");
  }
  const ext = safeExtension(input.filename);
  const parts = safeSegments(input.filename);
  const dirs = parts.slice(0, -1);
  const storageKey = [...dirs, `${randomUUID()}.${ext}`].join("/");
  const target = path.join(storageRoot(), ...storageKey.split("/"));

  await fs.mkdir(path.dirname(target), { recursive: true });
  const payload =
    typeof input.data === "string"
      ? Buffer.from(input.data, "utf8")
      : Buffer.from(input.data as ArrayBuffer);
  await fs.writeFile(target, payload);

  return { storageKey, url: `/${storageKey}`, size: dataSize(input.data) };
}

/** File lokal tidak memerlukan tanda tangan; kembalikan URL statis yang sama. */
export async function getSignedAssetUrl(storageKey: string): Promise<string> {
  return `/${normalizeKey(storageKey)}`;
}

export async function deleteObject(storageKey: string): Promise<void> {
  const target = path.join(storageRoot(), ...normalizeKey(storageKey).split("/"));
  await fs.rm(target, { force: true });
}

/** URL yang dipakai browser/Player untuk mengambil file dari route lokal. */
export function publicAssetUrl(storageKey: string): string {
  const key = normalizeKey(storageKey);
  if (key.startsWith("audio/")) return `/api/${key}`;
  const name = path.posix.basename(key);
  if (key.startsWith("renders/") || key.includes("/renders/")) return `/api/files/${name}`;
  return `/api/local/${key}`;
}
