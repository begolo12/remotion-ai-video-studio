import fs from "node:fs";
import { spawnSync } from "node:child_process";

const mp4 = process.argv[2];
fs.mkdirSync("C:/Users/User/Documents/remotion/out", { recursive: true });
const wav = "out/check.wav";
const ffmpeg = "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe";

const run = spawnSync(
  ffmpeg,
  ["-y", "-hide_banner", "-loglevel", "error", "-i", mp4, "-t", "12", "-ac", "1", "-ar", "8000", "-f", "wav", wav],
  { cwd: "C:/Users/User/Documents/remotion" },
);
if (run.status !== 0) {
  console.log("ffmpeg gagal", run.stderr?.toString().slice(0, 400));
  process.exit(1);
}

const buf = fs.readFileSync(`C:/Users/User/Documents/remotion/${wav}`);
let sum = 0;
let count = 0;
let peak = 0;
for (let i = 44; i < buf.length - 1; i += 2) {
  const v = buf.readInt16LE(i);
  sum += v * v;
  count += 1;
  if (Math.abs(v) > peak) peak = Math.abs(v);
}
const rms = Math.round(Math.sqrt(sum / Math.max(1, count)));
console.log(`sampel=${count} rms=${rms} peak=${peak} ${rms > 300 ? "ADA SUARA" : "SUNYI?"}`);
