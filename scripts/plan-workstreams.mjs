#!/usr/bin/env node
/**
 * Decompose the plan into independent parallel workstreams.
 *
 * A workstream owns a disjoint set of paths so builders can run at the same
 * time without touching each other's files. `dependsOn` orders workstreams;
 * everything with satisfied dependencies runs in one parallel batch.
 *
 * The planner agent may overwrite WORKSTREAMS.json with a richer split; this
 * script preserves any hand-authored items and only fills a baseline when the
 * file has none.
 *
 *   node plan-workstreams.mjs
 *   node plan-workstreams.mjs --status
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
    appendEvent,
    ensureRuntimeDirs,
    paths,
    readJson,
    writeJson,
} from "./paths.mjs";

ensureRuntimeDirs();

const statusOnly = process.argv.includes("--status");
const prev = readJson(paths.workstreams, null);

if (statusOnly) {
  const allPass =
    Boolean(prev?.items?.length) && prev.items.every((w) => w.pass);
  console.log(JSON.stringify({ ok: true, workstreams: prev, allPass }, null, 2));
  process.exit(allPass ? 0 : 3);
}

const parsed = spawnSync(
  process.execPath,
  [path.join(paths.pluginRoot, "scripts", "parse-plan.mjs")],
  { encoding: "utf8" }
);
if (parsed.status !== 0) {
  console.error(
    JSON.stringify({
      ok: false,
      needPlan: true,
      error: "No usable PLAN — run parse-plan/init-run first",
    })
  );
  process.exit(2);
}
const { plan } = JSON.parse(parsed.stdout.trim().split(/\r?\n/).pop());

// Preserve pass state and any hand-authored ownership from a previous split.
const prevById = new Map((prev?.items || []).map((w) => [w.id, w]));
const prevByTitle = new Map((prev?.items || []).map((w) => [norm(w.title), w]));

let items;
if (prev?.items?.length && prev.authored) {
  // Planner agent authored the split: keep it, just refresh pass bookkeeping.
  items = prev.items.map((w, i) => normalizeItem(w, i));
} else {
  items = baselineFromPlan(plan);
}

const batches = topoBatches(items);
const allPass = items.length > 0 && items.every((w) => w.pass);

const doc = {
  at: new Date().toISOString(),
  allPass,
  authored: Boolean(prev?.authored),
  rule:
    "Independent workstreams build in parallel; each owns disjoint paths. " +
    "Validate every WS* (validate-point --controller ctrl-divergence) before GOAL.",
  parallelism: batches.length
    ? Math.max(...batches.map((b) => b.length))
    : 0,
  batches,
  items,
};

writeJson(paths.workstreams, doc);
appendEvent({
  event: "plan-workstreams",
  count: items.length,
  batches: batches.length,
  parallelism: doc.parallelism,
});

console.log(
  JSON.stringify({
    ok: true,
    count: items.length,
    batches,
    parallelism: doc.parallelism,
    allPass,
    workstreams: paths.workstreams,
    next: "Fan out one wsai-builder per WS* in each batch, in parallel",
  })
);

function baselineFromPlan(plan) {
  // One workstream per plan step when steps exist, else one per feature.
  const steps = (plan.planSteps || []).filter((s) => s && (s.title || s.faire));
  const sources = steps.length
    ? steps.map((s, i) => ({
        title: (s.title || s.faire || `step ${i + 1}`).trim(),
        detail: s.faire || s.text || "",
        doc: s.doc || "",
      }))
    : (plan.features || []).map((f, i) => ({
        title: String(f).trim() || `feature ${i + 1}`,
        detail: String(f).trim(),
        doc: "",
      }));

  const used = new Set();
  return sources.map((s, i) => {
    const id = `WS${i + 1}`;
    let slug = slugify(s.title) || `unit-${i + 1}`;
    while (used.has(slug)) slug = `${slug}-${i + 1}`;
    used.add(slug);
    const old = prevById.get(id) || prevByTitle.get(norm(s.title));
    return normalizeItem(
      {
        id,
        title: s.title,
        detail: s.detail,
        doc: s.doc,
        owns: old?.owns?.length ? old.owns : [`src/${slug}`],
        dependsOn: old?.dependsOn || [],
        controller: "ctrl-divergence",
        worker: "wsai-builder",
        pass: old?.pass === true,
        evidence: old?.evidence || null,
        at: old?.at || null,
      },
      i
    );
  });
}

function normalizeItem(w, i) {
  const old = prevById.get(w.id);
  return {
    id: w.id || `WS${i + 1}`,
    title: String(w.title || `unit ${i + 1}`).trim(),
    detail: String(w.detail || "").trim(),
    doc: String(w.doc || "").trim(),
    owns: (w.owns || []).map(String).filter(Boolean),
    dependsOn: (w.dependsOn || []).map(String).filter(Boolean),
    controller: w.controller || "ctrl-divergence",
    worker: w.worker || "wsai-builder",
    pass: w.pass === true || old?.pass === true,
    evidence: w.evidence || old?.evidence || null,
    at: w.at || old?.at || null,
  };
}

/** Kahn layering: each batch holds workstreams whose deps are already done. */
function topoBatches(items) {
  const ids = new Set(items.map((w) => w.id));
  const remaining = new Map(
    items.map((w) => [w.id, w.dependsOn.filter((d) => ids.has(d) && d !== w.id)])
  );
  const done = new Set();
  const batches = [];
  let guard = items.length + 1;
  while (remaining.size && guard-- > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.every((d) => done.has(d)))
      .map(([id]) => id);
    if (!ready.length) {
      // Dependency cycle: drop remaining into one final batch rather than hang.
      batches.push([...remaining.keys()]);
      break;
    }
    batches.push(ready);
    for (const id of ready) {
      done.add(id);
      remaining.delete(id);
    }
  }
  return batches;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function norm(s) {
  return String(s || "").toLowerCase().trim();
}
