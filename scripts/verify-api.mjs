/**
 * Verifikasi end-to-end lewat HTTP: health → generate (AI nyata) → render MP4.
 * Pakai: node scripts/verify-api.mjs [baseUrl]
 */
const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async (timeoutMs = 120_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return await response.json();
    } catch {
      /* server belum siap */
    }
    await sleep(1500);
  }
  throw new Error(`Server ${base} tidak siap dalam ${timeoutMs / 1000}s`);
};

const json = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 400) };
  }
};

const main = async () => {
  const health = await waitForServer();
  console.log("[health]", JSON.stringify(health));

  const generateResponse = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description:
        "Tiga kebiasaan pagi yang bikin fokus kerja naik: minum air, jalan 10 menit, dan menulis satu prioritas harian.",
      targetSeconds: 30,
      styleId: "cinematic",
    }),
  });
  const generated = await json(generateResponse);
  if (!generateResponse.ok) {
    console.error("[generate] GAGAL", generateResponse.status, JSON.stringify(generated));
    process.exit(1);
  }
  const { project, model, fellBack } = generated;
  console.log(
    `[generate] OK model=${model} fellBack=${fellBack} project=${project.id} scene=${project.plan.scenes.length} judul="${project.plan.title}"`,
  );

  const renderResponse = await fetch(`${base}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: project.id }),
  });
  const rendered = await json(renderResponse);
  if (!renderResponse.ok) {
    console.error("[render] GAGAL", renderResponse.status, JSON.stringify(rendered));
    process.exit(1);
  }
  const jobId = rendered.job.id;
  console.log(`[render] job=${jobId} status=${rendered.job.status}`);

  const deadline = Date.now() + 15 * 60 * 1000;
  let job = rendered.job;
  while (Date.now() < deadline) {
    await sleep(2000);
    const poll = await fetch(`${base}/api/render/${jobId}`);
    const payload = await json(poll);
    job = payload.job ?? job;
    process.stdout.write(`\r[render] ${job.status} ${job.progress}%   `);
    if (job.status === "done" || job.status === "error") break;
  }
  process.stdout.write("\n");

  if (job.status !== "done") {
    console.error("[render] GAGAL:", job.message ?? "tidak selesai");
    console.error((job.logs ?? []).slice(-8).join("\n"));
    process.exit(1);
  }

  console.log(`[render] OK url=${job.url}`);
  console.log(`[render] file=${job.file}`);
  console.log(
    `[project] id=${project.id} target=${project.plan.targetSeconds}s fps=30 frame=${project.plan.targetSeconds * 30}`,
  );
};

main().catch((error) => {
  console.error("E2E gagal:", error.message);
  process.exit(1);
});
