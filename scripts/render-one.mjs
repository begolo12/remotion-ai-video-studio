const base = process.env.BASE ?? "http://127.0.0.1:3000";
const projectId = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const job = await fetch(`${base}/api/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ projectId }),
}).then((r) => r.json());

if (!job.job) {
  console.log("FAILED", JSON.stringify(job));
  process.exit(1);
}
console.log("job", job.job.id, job.job.status);
let state = job.job;
const deadline = Date.now() + 20 * 60 * 1000;
while (Date.now() < deadline) {
  await sleep(3000);
  state = await fetch(`${base}/api/render/${job.job.id}`).then((r) => r.json()).then((j) => j.job);
  process.stdout.write(`\r${state.status} ${state.progress}%   `);
  if (state.status === "done" || state.status === "error") break;
}
console.log("");
console.log(state.status, state.url ?? state.message);
