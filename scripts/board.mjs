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

const pointsDoc = readJson(paths.points);
if (!pointsDoc?.points) {
  console.error(JSON.stringify({ ok: false, error: "No POINTS.json — run init-run first" }));
  process.exit(1);
}

const events = fs.existsSync(paths.events)
  ? fs
      .readFileSync(paths.events, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  : [];

const latestByPoint = new Map();
for (const ev of events) {
  if (ev.event === "point-result" && ev.pointId) {
    latestByPoint.set(ev.pointId, ev);
  }
}

const points = pointsDoc.points.map((p) => {
  const ev = latestByPoint.get(p.id);
  if (!ev) return { ...p, pass: false, evidence: p.evidence || null };
  return {
    ...p,
    pass: Boolean(ev.pass),
    evidence: ev.evidence || null,
    controller: ev.controller || p.controller,
    note: ev.note || null,
    at: ev.at || null,
  };
});

const byKind = {
  research: summary(points.filter((p) => p.kind === "research")),
  todo: summary(points.filter((p) => p.kind === "todo")),
  workstream: summary(points.filter((p) => p.kind === "workstream")),
  feature: summary(points.filter((p) => p.kind === "feature")),
  "user-test": summary(points.filter((p) => p.kind === "user-test")),
  quality: summary(points.filter((p) => p.kind === "quality")),
  goal: summary(points.filter((p) => p.kind === "goal")),
};

const todosFile = readJson(paths.todos, null);
const missingTodos = (todosFile?.items || [])
  .filter((t) => !t.pass)
  .map((t) => t.id);
const todosOk =
  !todosFile?.items?.length ||
  (Boolean(todosFile.allPass) && missingTodos.length === 0);

const lexeme = readJson(path.join(paths.runtimeRoot, "validations", "LEXEME.json"), null);
const lexemeOk = lexeme?.pass === true;

const researchOk =
  byKind.research.total === 0 || byKind.research.failed === 0;
const workstreamsOk =
  byKind.workstream.total === 0 || byKind.workstream.failed === 0;
const featuresOk = byKind.feature.total === 0 || byKind.feature.failed === 0;
const testsOk =
  byKind["user-test"].total === 0 || byKind["user-test"].failed === 0;
const qualityOk = byKind.quality.total === 0 || byKind.quality.failed === 0;
const goalOk =
  byKind.goal.failed === 0 && byKind.goal.passed === byKind.goal.total;

const missing = [
  ...points.filter((p) => !p.pass).map((p) => p.id),
  ...missingTodos.filter((id) => !points.some((p) => p.id === id)),
  ...(lexemeOk ? [] : ["LEXEME"]),
];
const allPass =
  missing.length === 0 &&
  researchOk &&
  todosOk &&
  lexemeOk &&
  workstreamsOk &&
  featuresOk &&
  testsOk &&
  qualityOk &&
  goalOk;

const confirmation = [
  ...points.map((p) => ({
    id: p.id,
    kind: p.kind || null,
    text: p.text,
    pass: p.pass,
    controller: p.controller,
    worker: p.worker,
    evidence: p.evidence,
  })),
  ...(todosFile?.items || []).map((t) => ({
    id: t.id,
    kind: "todo",
    text: t.text,
    pass: t.pass,
    evidence: t.evidence,
  })),
];

const active = readJson(paths.active, { active: false });
const board = {
  at: new Date().toISOString(),
  allPass,
  researchOk,
  todosOk,
  lexemeOk,
  workstreamsOk,
  featuresOk,
  userTestsOk: testsOk,
  qualityOk,
  completeGoalOk: goalOk,
  active: Boolean(active.active) && !allPass,
  completeGoal:
    pointsDoc.sections?.completeGoal || active.completeGoal || null,
  missing,
  points,
  confirmation,
  byKind,
  divergence: points.some(
    (p) =>
      String(p.note || "").toLowerCase().includes("divergence") ||
      (p.controller === "ctrl-divergence" && !p.pass)
  ),
};

writeJson(paths.board, board);
writeJson(paths.points, { ...pointsDoc, points, at: board.at });

if (allPass && active.active) {
  writeJson(paths.active, { ...active, active: false, completedAt: board.at });
  appendEvent({ event: "board-complete", allPass: true });
} else {
  appendEvent({ event: "board-rebuild", allPass, missing });
}

console.log(
  JSON.stringify({
    ok: true,
    allPass,
    researchOk,
    todosOk,
    lexemeOk,
    workstreamsOk,
    featuresOk,
    userTestsOk: testsOk,
    qualityOk,
    completeGoalOk: goalOk,
    missing,
    board: paths.board,
  })
);

function summary(list) {
  return {
    total: list.length,
    passed: list.filter((p) => p.pass).length,
    failed: list.filter((p) => !p.pass).length,
    ids: list.map((p) => p.id),
  };
}
