#!/usr/bin/env node
/**
 * Stop hook — force the loop until research, todos, lexeme, and the board pass.
 *
 * Emits both contracts so one script drives both hosts:
 *   Claude Code: { "decision": "block", "reason": … }  (docs: hooks Stop)
 *   Cursor:      { "followup_message": … }
 * When nothing is pending it returns {} so the agent may stop.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");
const { paths, readJson } = await import(
  pathToFileURL(path.join(pluginRoot, "scripts", "paths.mjs")).href
);

function block(msg) {
  process.stdout.write(
    JSON.stringify({ decision: "block", reason: msg, followup_message: msg }) +
      "\n"
  );
  process.exit(0);
}
function allowStop() {
  process.stdout.write("{}\n");
  process.exit(0);
}

try {
  if (!process.stdin.isTTY) {
    await new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.on("data", () => {});
      process.stdin.on("end", resolve);
      setTimeout(resolve, 50);
    });
  }

  const active = readJson(paths.active);
  if (!active?.active) allowStop();

  const research = readJson(paths.research);
  if (research && !research.allPass) {
    const pending = (research.subjects || [])
      .filter((s) => !s.pass)
      .map((s) => s.id)
      .join(", ");
    block(
      `FORCE: research (${pending}). Non-AI Source+Extrait → validate-research.mjs. Do not ask user to reframe.`
    );
  }

  spawnSync(
    process.execPath,
    [path.join(pluginRoot, "scripts", "generate-todos.mjs")],
    { encoding: "utf8" }
  );
  const todos = readJson(paths.todos);
  if (todos?.items?.length && !todos.allPass) {
    const miss = todos.items
      .filter((t) => !t.pass)
      .map((t) => t.id)
      .join(", ");
    block(
      `FORCE: TODOs incomplete (${miss}). validate-todo.mjs with non-AI sources. No reframe.`
    );
  }

  spawnSync(
    process.execPath,
    [
      path.join(pluginRoot, "scripts", "validate-lexeme.mjs"),
      "--root",
      pluginRoot,
    ],
    { encoding: "utf8" }
  );
  const lexeme = readJson(
    path.join(paths.runtimeRoot, "validations", "LEXEME.json")
  );
  if (!lexeme?.pass) {
    block(
      `FORCE: lexeme fail (${lexeme?.fails?.length || "?"} dead words/chars). ` +
        `Every character must have a reason. Fix plugin texts → validate-lexeme.mjs. See validations/LEXEME.json`
    );
  }

  const deepenRun = spawnSync(
    process.execPath,
    [path.join(pluginRoot, "scripts", "deepen.mjs")],
    { encoding: "utf8" }
  );
  let deepenOut = {};
  try {
    deepenOut = JSON.parse(
      (deepenRun.stdout || "").trim().split(/\r?\n/).pop() || "{}"
    );
  } catch {
    deepenOut = {};
  }
  if (!deepenOut.saturated && deepenOut.followup) {
    block(deepenOut.followup);
  }

  spawnSync(process.execPath, [path.join(pluginRoot, "scripts", "board.mjs")], {
    encoding: "utf8",
  });
  const force = spawnSync(
    process.execPath,
    [path.join(pluginRoot, "scripts", "force-continue.mjs")],
    { encoding: "utf8" }
  );
  let payload = {};
  try {
    payload = JSON.parse(
      (force.stdout || "").trim().split(/\r?\n/).pop() || "{}"
    );
  } catch {
    payload = {};
  }
  if (payload.force && payload.message) {
    block(payload.message);
  }
  allowStop();
} catch {
  allowStop();
}
