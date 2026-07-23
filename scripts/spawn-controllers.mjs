#!/usr/bin/env node
/**
 * Write one spawn ticket per controller under the runtime spawn dir, plus a
 * PARALLEL.json that lists the workstream batches to fan out. Portable: every
 * path stays inside the runtime root.
 *
 *   node spawn-controllers.mjs
 */
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

const workstreams = readJson(paths.workstreams, { items: [], batches: [] });

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
      "If incomplete for your mission, write fail notes for FORCE_CONTINUE.",
      "Zero invented docs or APIs. Prefer official URLs.",
      "Evidence must be a real disk path the user can open.",
    ],
  };
  const local = path.join(paths.spawnDir, `${c.id}.SPAWN.json`);
  writeJson(local, ticket);
  tickets.push({ role: c.id, ticket: local });
}

// The parallel build plan: builders fan out one per WS in each batch, in order.
const parallel = {
  at: new Date().toISOString(),
  batches: workstreams.batches || [],
  workstreams: (workstreams.items || []).map((w) => ({
    id: w.id,
    title: w.title,
    owns: w.owns,
    dependsOn: w.dependsOn,
    worker: w.worker || "wsai-builder",
    controller: w.controller || "ctrl-divergence",
  })),
  builderCmd: `node "${paths.pluginRoot}/scripts/validate-point.mjs" --id <WS_ID> --pass true --evidence <PATH> --controller ctrl-divergence`,
};
const parallelPath = path.join(paths.spawnDir, "PARALLEL.json");
writeJson(parallelPath, parallel);

appendEvent({
  event: "spawn-controllers",
  count: tickets.length,
  batches: (workstreams.batches || []).length,
});
console.log(
  JSON.stringify({ ok: true, tickets, parallel: parallelPath, batches: parallel.batches })
);
