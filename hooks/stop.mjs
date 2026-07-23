#!/usr/bin/env node
/**
 * stop hook — research / todos / deepen / board
 * Source: https://cursor.com/docs/hooks followup_message
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");
const { paths, readJson } = await import(
  pathToFileURL(path.join(pluginRoot, "scripts", "paths.mjs")).href
);

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
  if (!active?.active) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const research = readJson(paths.research);
  if (research && !research.allPass) {
    const pending = (research.subjects || []).filter((s) => !s.pass).map((s) => s.id).join(", ");
    process.stdout.write(
      JSON.stringify({
        followup_message:
          `FORCE: research (${pending}). Non-AI Source+Extrait → validate-research.mjs. Do not ask user to reframe.`,
      }) + "\n"
    );
    process.exit(0);
  }

  spawnSync(process.execPath, [path.join(pluginRoot, "scripts", "generate-todos.mjs")], {
    encoding: "utf8",
  });
  const todos = readJson(paths.todos);
  if (todos?.items?.length && !todos.allPass) {
    const miss = todos.items.filter((t) => !t.pass).map((t) => t.id).join(", ");
    process.stdout.write(
      JSON.stringify({
        followup_message:
          `FORCE: TODOs from research not all validated (${miss}). validate-todo.mjs --pass --evidence (non-AI sources). See prompts/TODO.md`,
      }) + "\n"
    );
    process.exit(0);
  }

  const deepenRun = spawnSync(
    process.execPath,
    [path.join(pluginRoot, "scripts", "deepen.mjs")],
    { encoding: "utf8" }
  );
  let deepenOut = {};
  try {
    deepenOut = JSON.parse((deepenRun.stdout || "").trim().split(/\r?\n/).pop() || "{}");
  } catch {
    deepenOut = {};
  }
  if (!deepenOut.saturated && deepenOut.followup) {
    process.stdout.write(JSON.stringify({ followup_message: deepenOut.followup }) + "\n");
    process.exit(0);
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
    payload = JSON.parse((force.stdout || "").trim().split(/\r?\n/).pop() || "{}");
  } catch {
    payload = {};
  }
  if (payload.force && payload.message) {
    process.stdout.write(JSON.stringify({ followup_message: payload.message }) + "\n");
  } else {
    process.stdout.write("{}\n");
  }
  process.exit(0);
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}
