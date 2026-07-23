import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(__dirname, "..");

/** Runtime dir: WSAI_LOOP_ROOT, else PROJECT_ROOT/.wsai-loop, else ./.wsai-loop */
function resolveRuntimeRoot() {
  if (process.env.WSAI_LOOP_ROOT) return path.resolve(process.env.WSAI_LOOP_ROOT);
  if (process.env.PROJECT_ROOT) {
    return path.resolve(process.env.PROJECT_ROOT, ".wsai-loop");
  }
  return path.resolve(process.cwd(), ".wsai-loop");
}

export const RUNTIME_ROOT = resolveRuntimeRoot();

export const paths = {
  pluginRoot: PLUGIN_ROOT,
  runtimeRoot: RUNTIME_ROOT,
  prompt: path.join(RUNTIME_ROOT, "prompts", "CURRENT.md"),
  planMd: path.join(RUNTIME_ROOT, "prompts", "PLAN.md"),
  planJson: path.join(RUNTIME_ROOT, "prompts", "PLAN.json"),
  todoMd: path.join(RUNTIME_ROOT, "prompts", "TODO.md"),
  todos: path.join(RUNTIME_ROOT, "validations", "TODOS.json"),
  roles:
    fs.existsSync(path.join(RUNTIME_ROOT, "roles", "controllers.json"))
      ? path.join(RUNTIME_ROOT, "roles", "controllers.json")
      : path.join(PLUGIN_ROOT, "roles", "controllers.json"),
  points: path.join(RUNTIME_ROOT, "validations", "POINTS.json"),
  assignments: path.join(RUNTIME_ROOT, "validations", "ASSIGNMENTS.json"),
  events: path.join(RUNTIME_ROOT, "validations", "EVENTS.jsonl"),
  board: path.join(RUNTIME_ROOT, "validations", "BOARD.json"),
  active: path.join(RUNTIME_ROOT, "validations", "ACTIVE.json"),
  force: path.join(RUNTIME_ROOT, "validations", "FORCE_CONTINUE.json"),
  research: path.join(RUNTIME_ROOT, "validations", "RESEARCH.json"),
  deepen: path.join(RUNTIME_ROOT, "validations", "DEEPEN.json"),
  workstreams: path.join(RUNTIME_ROOT, "validations", "WORKSTREAMS.json"),
  spawnDir: path.join(RUNTIME_ROOT, "validations", "spawns"),
};

export function ensureRuntimeDirs() {
  for (const p of [
    path.join(RUNTIME_ROOT, "prompts"),
    path.join(RUNTIME_ROOT, "roles"),
    path.join(RUNTIME_ROOT, "validations"),
    path.join(RUNTIME_ROOT, "validations", "spawns"),
    path.join(RUNTIME_ROOT, "validations", "research"),
    path.join(RUNTIME_ROOT, "scripts"),
  ]) {
    fs.mkdirSync(p, { recursive: true });
  }
}

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function appendEvent(event) {
  ensureRuntimeDirs();
  const row = { at: new Date().toISOString(), ...event };
  fs.appendFileSync(paths.events, JSON.stringify(row) + "\n");
  return row;
}

export function extractSection(md, names) {
  for (const name of names) {
    const re = new RegExp(
      `(?:^|\\n)##?\\s*${escapeRe(name)}\\s*\\n([\\s\\S]*?)(?=\\n##?\\s+|$)`,
      "i"
    );
    const m = md.match(re);
    if (m?.[1]?.trim()) {
      return m[1]
        .split(/\r?\n/)
        .filter((l) => !/^\s*discussionId\s*:/i.test(l))
        .join("\n")
        .trim()
        .replace(/\r/g, "");
    }
  }
  return "";
}

export function extractField(md, names) {
  for (const name of names) {
    const re = new RegExp(`^\\s*${escapeRe(name)}\\s*:\\s*(.+)$`, "im");
    const m = md.match(re);
    if (m?.[1]?.trim()) return m[1].trim().replace(/\r/g, "");
  }
  return "";
}

export function bulletsFrom(section) {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]|\d+\./.test(l) || l.startsWith("[ ]") || l.startsWith("[x]"))
    .map((l) =>
      l
        .replace(/^[-*]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/^\[.\]\s*/, "")
        .replace(/\r/g, "")
        .trim()
    )
    .filter((l) => l && !/^-+$/.test(l));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
