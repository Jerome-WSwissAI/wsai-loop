#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
    appendEvent,
    ensureRuntimeDirs,
    paths,
    readJson,
    writeJson,
} from "./paths.mjs";

ensureRuntimeDirs();

const assignments = readJson(paths.assignments);
const points = readJson(paths.points);
if (!assignments?.controllers) {
  console.error(JSON.stringify({ ok: false, error: "Run init-run first" }));
  process.exit(1);
}

const raisonnement = "E:/WSAI/Orchestration/Raisonnement/workers";
fs.mkdirSync(raisonnement, { recursive: true });
fs.mkdirSync(paths.spawnDir, { recursive: true });

const tickets = [];
for (const c of assignments.controllers) {
  const related = (points?.points || []).filter((p) => p.controller === c.id);
  const ticket = {
    at: new Date().toISOString(),
    plugin: "wsai-loop",
    role: c.id,
    worker: c.worker,
    mission: c.mission,
    out: c.out,
    parallel: true,
    points: related.map((p) => ({ id: p.id, text: p.text })),
    promptPath: paths.prompt,
    validateCmd: `node "${paths.pluginRoot}/scripts/validate-point.mjs" --id <POINT_ID> --pass true|false --evidence <PATH> --controller ${c.id}`,
    boardCmd: `node "${paths.pluginRoot}/scripts/board.mjs"`,
    mandate: [
      "Frame Translator if work is not 100% correct for your mission.",
      "Force continuation material: write fail notes that ctrl-force can turn into FORCE_CONTINUE.",
      "Zero invented docs/APIs. Prefer official URLs.",
      "Evidence must be a real disk path Jerome can open.",
    ],
  };
  const local = path.join(paths.spawnDir, `${c.id}.SPAWN.json`);
  const worker = path.join(raisonnement, `wsai-loop-${c.id}.SPAWN.json`);
  writeJson(local, ticket);
  writeJson(worker, ticket);
  tickets.push({ role: c.id, local, worker });
}

appendEvent({ event: "spawn-controllers", count: tickets.length });
console.log(JSON.stringify({ ok: true, tickets }));
