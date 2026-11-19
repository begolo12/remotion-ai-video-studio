import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // State proyek ada di Neon dan AI dipanggil langsung, jadi caching komponen
  // Next 16 sengaja dimatikan agar tidak menyajikan data lama.
  cacheComponents: false,
  // Bundle Remotion dibutuhkan worker render di Vercel Sandbox. Tanpa include
  // ini, file bundle tidak ikut ter-trace ke dalam serverless function.
  outputFileTracingIncludes: {
    "/api/render": ["./.remotion/bundle/**/*"],
    "/api/render/[jobId]": ["./.remotion/bundle/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
