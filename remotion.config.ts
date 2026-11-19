import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
// Vercel build machine menyediakan 2 core; Remotion menolak concurrency di atas jumlah core.
Config.setConcurrency(2);
Config.setChromiumOpenGlRenderer("angle");
