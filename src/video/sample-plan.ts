import type { VideoPlan } from "../lib/plan/schema";

/** Rencana contoh: dipakai sebagai default props Remotion dan data uji. */
export const SAMPLE_PLAN: VideoPlan = {
  version: 1,
  title: "3 Kebiasaan Pagi yang Mengubah Hari",
  hook: "Tiga kebiasaan ini cuma butuh 10 menit",
  styleId: "cinematic",
  targetSeconds: 30,
  scenes: [
    {
      template: "hook",
      heading: "Pagi kamu berantakan?",
      subheading: "Coba tiga hal ini besok",
      weight: 1,
      narration: "Pagi kamu berantakan? Coba tiga hal ini besok.",
    },
    {
      template: "bullets",
      heading: "Rutinitas 10 menit",
      bullets: ["Minum air putih", "Jangan buka HP", "Tulis satu target"],
      weight: 1.2,
      narration: "Minum air putih, jangan buka HP, lalu tulis satu target.",
    },
    {
      template: "stat",
      value: "82%",
      label: "orang merasa lebih fokus setelah 10 menit tanpa layar",
      weight: 1,
      narration: "Delapan puluh dua persen orang merasa lebih fokus.",
    },
    {
      template: "statement",
      heading: "Mulai dari yang paling kecil",
      text: "Konsistensi kecil mengalahkan rencana besar yang tidak pernah jalan.",
      weight: 1,
      narration: "Mulai dari yang paling kecil.",
    },
  ],
  outro: { heading: "Coba besok pagi", cta: "Simpan video ini" },
  caption:
    "Tiga kebiasaan pagi yang cuma butuh 10 menit. Coba besok dan rasakan bedanya.",
  hashtags: ["#shorts", "#produktivitas", "#kebiasaanpagi"],
  narration: [],
  musicMood: "lo-fi hangat, tempo santai",
};
