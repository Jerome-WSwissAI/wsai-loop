#!/usr/bin/env node
/**
 * preToolUse gate — learn-first.
 * Source schema: https://cursor.com/docs/hooks (permission allow|deny, failClosed)
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathsMod = await import(
  pathToFileURL(path.join(__dirname, "..", "scripts", "paths.mjs")).href
);
const { paths, readJson } = pathsMod;

const MUTATING = new Set(["Write", "StrReplace", "Edit", "EditNotebook", "Delete", "DeleteFile"]);
const ALLOW_RE =
  /[\\/](prompts[\\/](CURRENT|PLAN|TODO|LIST)\.(md|json)|validations[\\/](RESEARCH|PHASE|ACTIVE|EVENTS|TODOS|DEEPEN|POINTS)\.json|validations[\\/]research[\\/])/i;

// Emit both contracts: Claude Code reads hookSpecificOutput.permissionDecision
// (docs: hooks PreToolUse); Cursor reads the top-level permission field.
function deny(msg) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: msg,
      },
      permission: "deny",
      user_message: msg,
      agent_message: msg,
    }) + "\n"
  );
  process.exit(0);
}
function allow() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
      },
      permission: "allow",
    }) + "\n"
  );
  process.exit(0);
}

const input = await new Promise((resolve) => {
  const chunks = [];
  if (process.stdin.isTTY) return resolve({});
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    } catch {
      resolve({});
    }
  });
  setTimeout(() => resolve({}), 100);
});

const active = readJson(paths.active);
if (!active?.active) allow();

const name = String(input.tool_name || input.toolName || "").trim();
if (!MUTATING.has(name)) allow();

const ti = input.tool_input || input.toolInput || input.input || {};
const fp = String(ti.path || ti.file_path || ti.filePath || "").replace(/\\/g, "/");
const allowed = fp && ALLOW_RE.test(fp);

const research = readJson(paths.research);
const phase = readJson(path.join(paths.runtimeRoot, "validations", "PHASE.json"));
const researchDone = research?.allPass === true;
const needPlan = phase?.needPlan === true || phase?.phase === "comprehension";

if (needPlan && !allowed) {
  deny("wsai-loop GATE: write PLAN.md first (prompts/).");
}
if (!researchDone && !allowed) {
  const pending = (research?.subjects || []).filter((s) => !s.pass).map((s) => s.id).join(", ");
  deny(
    `wsai-loop GATE: research not validated (${pending || "no RESEARCH"}). ` +
      `Non-AI Source:+Extrait: then validate-research.mjs. Then generate-todos + validate every TD*.`
  );
}
allow();
