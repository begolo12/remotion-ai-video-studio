import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/User/Documents/remotion";
const dir = path.join(root, "data/projects");
const target = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

fs.mkdirSync(path.join(root, "out"), { recursive: true });
fs.writeFileSync(path.join(root, "out/props-check.json"), JSON.stringify({ plan: target.plan }), "utf8");
console.log("project:", target.id, "|", target.plan.title, "|", target.plan.styleId, "| scenes:", target.plan.scenes.length);
console.log("narration:", target.plan.scenes.map((s) => (s.narration ?? "").slice(0, 45)));
