#!/usr/bin/env node
/**
 * Natural-language besoin in CURRENT.md → after PLAN.md exists → POINTS.
 * Phase A (no plan): exit 3 { needPlan:true, besoin }
 * Phase B (plan ok): ACTIVE + POINTS from features + userTests + qualityGoals + completeGoal
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
    appendEvent,
    ensureRuntimeDirs,
    extractField,
    extractSection,
    paths,
    readJson,
    writeJson,
} from "./paths.mjs";

ensureRuntimeDirs();

if (!fs.existsSync(paths.prompt)) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Missing prompts/CURRENT.md — write the natural need there",
      expected: paths.prompt,
    })
  );
  process.exit(1);
}

const prompt = fs.readFileSync(paths.prompt, "utf8");
const besoin =
  extractSection(prompt, ["Besoin", "Need", "Demande", "Want"]) ||
  extractSection(prompt, ["But", "Goal"]) ||
  prompt.replace(/^#+\s*.*$/m, "").trim();

if (!besoin || besoin.length < 8) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Besoin trop vide — décrire ce qui est voulu (langage naturel)",
    })
  );
  process.exit(1);
}

const discussionId = extractField(prompt, ["discussionId", "DiscussionId"]);

// Sync roles
fs.copyFileSync(
  paths.roles,
  path.join(paths.runtimeRoot, "roles", "controllers.json")
);
const roles = JSON.parse(fs.readFileSync(paths.roles, "utf8"));
const controllers = roles.controllers;

const parsed = spawnSync(
  process.execPath,
  [path.join(paths.pluginRoot, "scripts", "parse-plan.mjs")],
  { encoding: "utf8" }
);

if (parsed.status !== 0) {
  const err = tryJson(parsed.stderr) || tryJson(parsed.stdout) || {
    needPlan: true,
  };
  writeJson(path.join(paths.runtimeRoot, "validations", "PHASE.json"), {
    at: new Date().toISOString(),
    phase: "comprehension",
    besoin: besoin.slice(0, 500),
    discussionId: discussionId || null,
    needPlan: true,
  });
  appendEvent({ event: "need-plan", besoin: besoin.slice(0, 200) });
  console.log(
    JSON.stringify({
      ok: false,
      needPlan: true,
      phase: "comprehension",
      besoin: besoin.slice(0, 500),
      planMd: paths.planMd,
      planJson: paths.planJson,
      hint: "Write PLAN.md: Recherche (sujets) → Plan (Doc/Faire/agent) → Validation avant livraison (exercices) + Fonctionnalites/Quality/But, then re-run init-run.mjs",
      parseError: err,
    })
  );
  process.exit(3);
}

const { plan } = JSON.parse(parsed.stdout.trim().split(/\r?\n/).pop());
const at = new Date().toISOString();

const researchPath = path.join(paths.runtimeRoot, "validations", "RESEARCH.json");
const researchSubjects = (plan.researchSubjects || []).map((s, i) => ({
  id: s.id || `R${i + 1}`,
  title: s.title || String(s),
  pass: false,
  evidence: null,
  reason: null,
  at: null,
}));
writeJson(researchPath, {
  at,
  allPass: researchSubjects.length === 0,
  subjects: researchSubjects,
  rule: "Non-AI Source:+Extrait: then validate-research.mjs. AI notes ≠ source.",
});
fs.mkdirSync(path.join(paths.runtimeRoot, "validations", "research"), {
  recursive: true,
});

spawnSync(
  process.execPath,
  [path.join(paths.pluginRoot, "scripts", "generate-todos.mjs")],
  { encoding: "utf8" }
);
const todosDoc = JSON.parse(
  fs.existsSync(path.join(paths.runtimeRoot, "validations", "TODOS.json"))
    ? fs.readFileSync(
        path.join(paths.runtimeRoot, "validations", "TODOS.json"),
        "utf8"
      )
    : '{"items":[]}'
);

// Decompose into parallel workstreams (disjoint owned paths + dependency batches).
spawnSync(
  process.execPath,
  [path.join(paths.pluginRoot, "scripts", "plan-workstreams.mjs")],
  { encoding: "utf8" }
);
const workstreamsDoc = readJson(paths.workstreams, { items: [], batches: [] });

const points = [];
const raw = [];
for (const r of researchSubjects) {
  raw.push({
    kind: "research",
    text: r.title,
    controller: "ctrl-docs",
    idHint: r.id,
  });
}
for (const td of todosDoc.items || []) {
  raw.push({
    kind: "todo",
    text: td.text,
    controller: "ctrl-hostile",
    idHint: td.id,
  });
}
for (const ws of workstreamsDoc.items || []) {
  raw.push({
    kind: "workstream",
    text: `${ws.title} [owns ${(ws.owns || []).join(", ") || "src"}]`,
    controller: ws.controller || "ctrl-divergence",
    idHint: ws.id,
  });
}
for (const f of plan.features) {
  raw.push({ kind: "feature", text: f, controller: "ctrl-divergence" });
}
for (const t of plan.userTests) {
  raw.push({ kind: "user-test", text: t, controller: "ctrl-hostile" });
}
for (const q of plan.qualityGoals) {
  raw.push({ kind: "quality", text: q, controller: "ctrl-docs" });
}
raw.push({
  kind: "goal",
  text: plan.completeGoal,
  controller: "ctrl-final",
});

const counters = {
  research: 0,
  todo: 0,
  workstream: 0,
  feature: 0,
  "user-test": 0,
  quality: 0,
  goal: 0,
};
const idPrefix = {
  research: "R",
  todo: "TD",
  workstream: "WS",
  feature: "F",
  "user-test": "T",
  quality: "Q",
  goal: "GOAL",
};

for (const item of raw) {
  counters[item.kind] += 1;
  const c =
    controllers.find((x) => x.id === item.controller) || controllers[0];
  const id =
    item.kind === "goal"
      ? "GOAL"
      : item.idHint || `${idPrefix[item.kind]}${counters[item.kind]}`;
  points.push({
    id,
    kind: item.kind,
    text: item.text,
    pass: false,
    evidence: null,
    controller: c.id,
    worker: c.worker,
  });
}

const sections = {
  besoin: plan.besoin || besoin,
  comprehension: plan.comprehension || "",
  completeGoal: plan.completeGoal,
  discussionId: discussionId || null,
  researchSubjects: researchSubjects.map((s) => s.title),
  workstreams: (workstreamsDoc.items || []).map((w) => w.id),
  parallelBatches: workstreamsDoc.batches || [],
  features: plan.features,
  userTests: plan.userTests,
  qualityGoals: plan.qualityGoals,
  planSteps: plan.planSteps || [],
};

const assignments = {
  at,
  promptPath: paths.prompt,
  planPath: fs.existsSync(paths.planMd) ? paths.planMd : paths.planJson,
  sections,
  controllers,
  points: points.map((p) => ({
    id: p.id,
    kind: p.kind,
    controller: p.controller,
    worker: p.worker,
  })),
};

const active = {
  active: true,
  at,
  phase: "research",
  maxForceLoops: Number(process.env.WSAI_LOOP_MAX || 12),
  forceLoops: 0,
  besoin: sections.besoin.split("\n")[0].slice(0, 200),
  completeGoal: sections.completeGoal.slice(0, 200),
  discussionId: sections.discussionId,
  researchGate: true,
};

writeJson(paths.points, { at, sections, points });
writeJson(paths.assignments, assignments);
writeJson(paths.active, active);
writeJson(path.join(paths.runtimeRoot, "validations", "PHASE.json"), {
  at,
  phase: "research",
  needPlan: false,
  researchOk: false,
  besoin: sections.besoin.slice(0, 500),
  completeGoal: sections.completeGoal,
  counts: {
    research: researchSubjects.length,
    todos: (todosDoc.items || []).length,
    workstreams: (workstreamsDoc.items || []).length,
    features: plan.features.length,
    userTests: plan.userTests.length,
    qualityGoals: plan.qualityGoals.length,
    goal: 1,
  },
});
writeJson(paths.board, {
  at,
  allPass: false,
  active: true,
  researchOk: false,
  todosOk: false,
  completeGoal: sections.completeGoal,
  missing: points.map((p) => p.id),
  points,
  confirmation: [],
  byKind: {
    research: points.filter((p) => p.kind === "research").map((p) => p.id),
    todo: points.filter((p) => p.kind === "todo").map((p) => p.id),
    workstream: points.filter((p) => p.kind === "workstream").map((p) => p.id),
    feature: points.filter((p) => p.kind === "feature").map((p) => p.id),
    "user-test": points.filter((p) => p.kind === "user-test").map((p) => p.id),
    quality: points.filter((p) => p.kind === "quality").map((p) => p.id),
    goal: ["GOAL"],
  },
});
if (fs.existsSync(paths.force)) fs.unlinkSync(paths.force);

appendEvent({
  event: "init-run",
  points: points.length,
  research: researchSubjects.length,
  todos: (todosDoc.items || []).length,
  workstreams: (workstreamsDoc.items || []).length,
  features: plan.features.length,
  userTests: plan.userTests.length,
  qualityGoals: plan.qualityGoals.length,
  phase: "research",
});

fs.mkdirSync(paths.spawnDir, { recursive: true });
for (const c of controllers) {
  writeJson(path.join(paths.spawnDir, `${c.id}.SPAWN.json`), {
    at,
    role: c.id,
    worker: c.worker,
    mission: c.mission,
    out: c.out,
    promptPath: paths.prompt,
    planPath: assignments.planPath,
    pointsPath: paths.points,
    boardPath: paths.board,
    instruction:
      "R* research (non-AI sources) → generate-todos → validate every TD* → F/T/Q/GOAL. AI notes ≠ source.",
  });
}

console.log(
  JSON.stringify({
    ok: true,
    phase: "research",
    researchGate: true,
    research: researchPath,
    todos: path.join(paths.runtimeRoot, "validations", "TODOS.json"),
    points: points.length,
    byKind: {
      research: researchSubjects.length,
      todos: (todosDoc.items || []).length,
      workstreams: (workstreamsDoc.items || []).length,
      features: plan.features.length,
      userTests: plan.userTests.length,
      qualityGoals: plan.qualityGoals.length,
      goal: 1,
    },
    parallelBatches: workstreamsDoc.batches || [],
    board: paths.board,
    plan: assignments.planPath,
    next: "validate-research R* → build WS* in parallel batches → validate-todo TD* → board",
  })
);

function tryJson(s) {
  try {
    return JSON.parse(String(s || "").trim().split(/\r?\n/).pop());
  } catch {
    return null;
  }
}
