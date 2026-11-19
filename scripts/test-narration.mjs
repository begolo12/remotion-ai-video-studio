const base = process.env.BASE ?? "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wait = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {
      /* belum siap */
    }
    await sleep(1500);
  }
  throw new Error("server tidak siap");
};

await wait();
const t0 = Date.now();
const res = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    description:
      "Tiga kesalahan kecil saat wawancara kerja yang bikin kamu langsung gugur, dan cara memperbaikinya dalam satu menit.",
    targetSeconds: 45,
    styleId: "cinematic",
    voice: "male",
    withNarration: true,
  }),
});
const body = await res.json();
console.log("status", res.status, "in", ((Date.now() - t0) / 1000).toFixed(1) + "s");
console.log("model:", body.model, "| fellBack:", body.fellBack);
console.log("narration:", JSON.stringify(body.narration));
console.log("title:", body.plan?.title);
for (const [i, scene] of (body.plan?.scenes ?? []).entries()) {
  console.log(
    `  ${i + 1}. ${scene.template} | audio=${scene.audio?.seconds ?? "-"}s | "${(scene.narration ?? "").slice(0, 60)}"`,
  );
}
console.log("projectId:", body.project?.id);
if (body.error) console.log("ERROR", body.error, body.detail ?? "");
