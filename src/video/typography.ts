import type React from "react";

/**
 * Tipografi defensif: teks dari AI bisa berupa satu kata sangat panjang
 * (URL, hashtag gabungan, atau salah ketik). Tanpa aturan ini teks akan
 * melebar keluar kanvas 1080px.
 */
export const WRAP: React.CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  hyphens: "auto",
};

/**
 * Pilih ukuran font berdasarkan panjang teks.
 * `tiers` diurutkan dari panjang teks terpanjang ke terpendek.
 */
export const fitSize = (
  text: string,
  tiers: Array<{ minLength: number; size: number }>,
  fallback: number,
): number => {
  const length = (text ?? "").length;
  for (const tier of tiers) {
    if (length > tier.minLength) return tier.size;
  }
  return fallback;
};
