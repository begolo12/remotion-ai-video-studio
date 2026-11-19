import { randomUUID } from "node:crypto";
import { del, issueSignedToken, presignUrl, put } from "@vercel/blob";

export type StoredObject = { storageKey: string; url: string; size: number };

const SAFE_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "json",
  "srt",
  "vtt",
  "txt",
  "pdf",
]);

function requireToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN belum diset. Tambahkan token Vercel Blob ke environment sebelum mengunggah aset.",
    );
  }
  return token;
}

function normalizeKey(storageKey: string): string {
  const key = storageKey.trim().replace(/^\/+/, "");
  if (!key || key.includes("..") || /\s/.test(key)) {
    throw new Error("storageKey tidak valid");
  }
  return key;
}

function dataSize(data: Buffer | Uint8Array | ArrayBuffer | string | Blob): number {
  if (typeof data === "string") return Buffer.byteLength(data, "utf8");
  const like = data as { byteLength?: number; length?: number; size?: number };
  if (typeof like.size === "number") return like.size;
  return like.byteLength ?? like.length ?? 0;
}

function safeExtension(filename: string): string {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (!ext || !SAFE_EXTENSIONS.has(ext)) {
    throw new Error(`Ekstensi file "${filename}" tidak didukung`);
  }
  return ext;
}

function pathPrefix(): string {
  const raw = process.env.BLOB_PATH_PREFIX ?? "assets";
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "")
    .replace(/^\/+|\/+$/g, "");
  return cleaned || "assets";
}

/** Unggah objek dengan nama acak; kunci (= pathname Blob) disimpan di DB. */
export async function putObject(input: {
  data: Buffer | Uint8Array | ArrayBuffer | string | Blob;
  filename: string;
  contentType?: string;
  access?: "public" | "private";
}): Promise<StoredObject> {
  const token = requireToken();
  if (typeof input.filename !== "string" || input.filename.length === 0) {
    throw new Error("filename wajib diisi");
  }
  const ext = safeExtension(input.filename);
  const storageKey = `${pathPrefix()}/${randomUUID()}.${ext}`;

  const result = await put(storageKey, input.data as Parameters<typeof put>[1], {
    access: input.access ?? "public",
    contentType: input.contentType,
    addRandomSuffix: false,
    allowOverwrite: false,
    token,
  });

  return { storageKey: result.pathname, url: result.url, size: dataSize(input.data) };
}

/** URL GET bertanda tangan untuk aset privat; token baca-tulis tidak ikut dikirim. */
export async function getSignedAssetUrl(
  storageKey: string,
  expiresInSeconds = 60 * 5,
): Promise<string> {
  const key = normalizeKey(storageKey);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("expiresInSeconds harus angka positif");
  }

  const validUntil = Date.now() + Math.min(expiresInSeconds, 60 * 60) * 1000;
  const signed = await issueSignedToken({
    pathname: key,
    operations: ["get"],
    validUntil,
    token: requireToken(),
  });
  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname: key,
    access: "private",
    validUntil: signed.validUntil,
  });
  return presignedUrl;
}

export async function deleteObject(storageKey: string): Promise<void> {
  await del(normalizeKey(storageKey), { token: requireToken() });
}

function storeId(): string {
  const explicit = process.env.BLOB_STORE_ID;
  if (explicit) return explicit;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token?.startsWith("vercel_blob_rw_")) {
    throw new Error("BLOB_STORE_ID tidak ditemukan dan token Blob tidak dikenali");
  }
  const rest = token.slice("vercel_blob_rw_".length);
  const id = rest.slice(0, rest.lastIndexOf("_"));
  if (!id) {
    throw new Error("Tidak bisa menentukan store id dari BLOB_READ_WRITE_TOKEN");
  }
  return id;
}

/** URL publik bersifat deterministik: tidak memanggil jaringan dan tanpa token. */
export function publicAssetUrl(storageKey: string): string {
  return `https://${storeId()}.public.blob.vercel-storage.com/${normalizeKey(storageKey)}`;
}
