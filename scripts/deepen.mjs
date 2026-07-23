#!/usr/bin/env node
/**
 * [process] Deepen loop: push research/reasoning further → richer lists → re-loop
 * until saturated (no new gaps). Realization = one-shot; do not ask Jerome to reframe.
 *
 * Usage:
 *   node deepen.mjs              # propose gaps / update DEEPEN.json
 *   node deepen.mjs --saturate   # mark saturated after hostile check (explicit)
 *   node deepen.mjs --status
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
    appendEvent,
    ensureRuntimeDirs,
    paths,
    readJson,
    writeJson,
} from "./paths.mjs";

ensureRuntimeDirs();

const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const forceSaturate = args.includes("--saturate");

const deepenPath = path.join(paths.runtimeRoot, "validations", "DEEPEN.json");
const listPath = path.join(paths.runtimeRoot, "prompts", "LIST.md");
const researchPath = path.join(paths.runtimeRoot, "validations", "RESEARCH.json");
const researchDir = path.join(paths.runtimeRoot, "validations", "research");

const research = readJson(researchPath, { subjects: [], allPass: false });
let deepen = readJson(deepenPath, null) || {
  at: null,
  round: 0,
  saturated: false,
  gaps: [],
  addedSubjects: [],
  rule: "Deepen until no new gaps; Jerome must not reframe. Realization = one-shot complete.",
};

if (statusOnly) {
  console.log(JSON.stringify({ ok: true, deepen, researchOk: research.allPass }, null, 2));
  process.exit(deepen.saturated ? 0 : 3);
}

if (forceSaturate) {
  deepen.saturated = true;
  deepen.at = new Date().toISOString();
  deepen.note = "explicit --saturate after hostile no-return check";
  writeJson(deepenPath, deepen);
  appendEvent({ event: "deepen-saturate", round: deepen.round });
  console.log(JSON.stringify({ ok: true, saturated: true, deepen: deepenPath }));
  process.exit(0);
}

deepen.round = Number(deepen.round || 0) + 1;
deepen.at = new Date().toISOString();
deepen.saturated = false;

spawnSync(
  process.execPath,
  [path.join(paths.pluginRoot, "scripts", "generate-todos.mjs")],
  { encoding: "utf8" }
);

const evidenceFiles = fs.existsSync(researchDir)
  ? fs.readdirSync(researchDir).filter((f) => /\.(md|json|txt)$/i.test(f))
  : [];

const gaps = [];
const subjects = research.subjects || [];
const todos = readJson(paths.todos, { items: [] });
if (todos.items?.length && !todos.allPass) {
  const miss = todos.items.filter((t) => !t.pass).map((t) => t.id);
  gaps.push({
    kind: "todos-open",
    action: `Validate todos ${miss.join(", ")} via validate-todo.mjs (non-AI sources)`,
  });
}

for (const s of subjects) {
  if (!s.pass) {
    gaps.push({
      kind: "unvalidated-subject",
      id: s.id,
      title: s.title,
      action: `Cite non-AI Source:+Extrait: then validate-research.mjs --id ${s.id} --pass --evidence`,
    });
  } else if (!s.evidence || !fs.existsSync(s.evidence)) {
    gaps.push({
      kind: "missing-evidence",
      id: s.id,
      title: s.title,
      action: "Evidence path missing on disk",
    });
  } else if (!s.sources?.length) {
    gaps.push({
      kind: "ai-only-or-unsourced",
      id: s.id,
      title: s.title,
      action:
        "Re-validate: AI notes are NOT sources. Need Source: https://… + Extrait verbatim from non-AI page",
    });
  }
}

// Scan research/*.md for AI-only files (no Source: http)
if (fs.existsSync(researchDir)) {
  for (const f of evidenceFiles) {
    const p = path.join(researchDir, f);
    let t = "";
    try {
      t = fs.readFileSync(p, "utf8");
    } catch {
      continue;
    }
    const hasSource = /(^|\n)\s*(Source|Doc|URL)\s*:\s*https?:\/\//i.test(t);
    const hasExcerpt = /Extrait\s*:/i.test(t) || /Quote\s*:/i.test(t);
    if (!hasSource || !hasExcerpt) {
      gaps.push({
        kind: "ai-doc-useless",
        action: `Delete or rewrite ${f}: must be citation index only (Source+Extrait non-IA), not AI essay`,
      });
    }
  }
}

// Heuristic deepen: if few subjects or thin evidence set, demand expansion
if (subjects.length < 5) {
  gaps.push({
    kind: "thin-research",
    action:
      "Append new ### Sujet N to PLAN.md Recherche (blind spots, edges, docs URLs, failure modes) then init-run or merge into RESEARCH",
  });
}
if (evidenceFiles.length < subjects.filter((s) => s.pass).length) {
  gaps.push({
    kind: "evidence-lag",
    action: "Each passed subject needs a durable evidence file in validations/research/",
  });
}

// Read LIST.md open items
if (fs.existsSync(listPath)) {
  const list = fs.readFileSync(listPath, "utf8");
  const open = list
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s*\[[ ]\]/.test(l) || /^[-*]\s+TODO/i.test(l));
  for (const line of open) {
    gaps.push({ kind: "list-open", action: line.replace(/^[-*]\s*/, "") });
  }
}

deepen.gaps = gaps;
deepen.saturated = gaps.length === 0 && research.allPass === true && subjects.length > 0;

const listBody = [
  `# LIST — deepen round ${deepen.round}`,
  ``,
  `saturated: ${deepen.saturated}`,
  `research.allPass: ${research.allPass}`,
  ``,
  `## Gaps (must close — do not ask Jerome to reframe)`,
  ...(gaps.length
    ? gaps.map((g, i) => `- [ ] G${i + 1} [${g.kind}] ${g.action}`)
    : [`- [x] none — candidate saturation`]),
  ``,
  `## Subjects`,
  ...subjects.map(
    (s) => `- [${s.pass ? "x" : " "}] ${s.id} ${s.title} ${s.evidence || ""}`
  ),
  ``,
  `## Rule`,
  `Realization = one-shot complete. Loop until gaps empty + RESEARCH allPass + hostile no-return.`,
  ``,
].join("\n");

fs.writeFileSync(listPath, listBody, "utf8");
writeJson(deepenPath, deepen);
appendEvent({
  event: "deepen-round",
  round: deepen.round,
  gaps: gaps.length,
  saturated: deepen.saturated,
});

const followup = deepen.saturated
  ? null
  : [
      "FORCE_DEEPEN — list incomplete; push reasoning/research further.",
      `Round ${deepen.round}. Gaps: ${gaps.length}.`,
      "Do NOT ask Jerome to reframe. Expand PLAN Recherche / proofs / LIST until deepen.saturated.",
      `See ${listPath}`,
      ...gaps.slice(0, 8).map((g, i) => `${i + 1}. [${g.kind}] ${g.action}`),
    ].join("\n");

console.log(
  JSON.stringify({
    ok: true,
    round: deepen.round,
    saturated: deepen.saturated,
    gaps: gaps.length,
    list: listPath,
    deepen: deepenPath,
    followup,
  })
);
process.exit(deepen.saturated ? 0 : 3);
