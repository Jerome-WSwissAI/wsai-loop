#!/usr/bin/env node
import {
    appendEvent,
    ensureRuntimeDirs,
    paths,
    readJson,
    writeJson,
} from "./paths.mjs";

ensureRuntimeDirs();

const active = readJson(paths.active, { active: false });
const board = readJson(paths.board, { allPass: false, missing: [], points: [] });

if (!active.active) {
  console.log(JSON.stringify({ ok: true, force: false, reason: "loop inactive" }));
  process.exit(0);
}

if (board.allPass) {
  console.log(JSON.stringify({ ok: true, force: false, reason: "board allPass" }));
  process.exit(0);
}

const missingPoints = (board.points || []).filter((p) => !p.pass);
const missingList = missingPoints.map(
  (p) => `${p.id} [${p.controller}] ${p.text}`
);

const forceLoops = Number(active.forceLoops || 0) + 1;
const maxForceLoops = Number(active.maxForceLoops || 12);

if (forceLoops > maxForceLoops) {
  const payload = {
    at: new Date().toISOString(),
    event: "FORCE_STOP_MAX",
    forceLoops,
    maxForceLoops,
    missing: missingList,
  };
  writeJson(paths.force, payload);
  writeJson(paths.active, { ...active, active: false, stopped: "max_force" });
  appendEvent(payload);
  console.log(JSON.stringify({ ok: true, force: false, reason: "max_force", ...payload }));
  process.exit(0);
}

const message = [
  "FORCE_CONTINUE — incomplete (one-shot not reached).",
  `Goal: ${board.completeGoal || active.completeGoal || "(unset)"}`,
  "Missing (R*/TD*/LEXEME/F*/T*/Q*/GOAL):",
  ...missingList.map((l) => `- ${l}`),
  "",
  "Rules:",
  "1. Do not ask the user to reframe — deepen, validate, controllers.",
  "2. deepen → validate-lexeme → validate-point → board.",
  "3. Done only when BOARD.allPass (incl. lexemeOk + todosOk).",
  `Force loop ${forceLoops}/${maxForceLoops}`,
].join("\n");

const payload = {
  at: new Date().toISOString(),
  event: "FORCE_CONTINUE",
  forceLoops,
  maxForceLoops,
  missing: missingList,
  message,
};

writeJson(paths.active, { ...active, forceLoops });
writeJson(paths.force, payload);
appendEvent({ event: "FORCE_CONTINUE", forceLoops, missing: board.missing });

console.log(JSON.stringify({ ok: true, force: true, ...payload }));
