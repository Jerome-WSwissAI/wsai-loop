#!/usr/bin/env node
/**
 * Usage:
 *   node validate-point.mjs --id P1 --pass true --evidence PATH --controller ctrl-docs [--note "..."]
 */
import {
    appendEvent,
    ensureRuntimeDirs,
    paths,
    readJson,
} from "./paths.mjs";

ensureRuntimeDirs();

const args = parseArgs(process.argv.slice(2));
const pointId = args.id;
const pass = String(args.pass).toLowerCase() === "true" || args.pass === true;
const evidence = args.evidence || null;
const controller = args.controller || null;
const note = args.note || null;

if (!pointId) {
  console.error(JSON.stringify({ ok: false, error: "Missing --id" }));
  process.exit(1);
}

if (pass && !evidence) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "pass=true requires --evidence path on disk",
    })
  );
  process.exit(2);
}

const pointsDoc = readJson(paths.points);
if (!pointsDoc?.points?.some((p) => p.id === pointId)) {
  console.error(JSON.stringify({ ok: false, error: `Unknown point ${pointId}` }));
  process.exit(3);
}

appendEvent({
  event: "point-result",
  pointId,
  pass,
  evidence,
  controller,
  note,
});

console.log(
  JSON.stringify({
    ok: true,
    pointId,
    pass,
    evidence,
    next: `node "${paths.pluginRoot}/scripts/board.mjs"`,
  })
);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}
