#!/usr/bin/env node
/**
 * Validate a research subject (learn-first gate).
 *
 * RULE: AI-written notes are NOT sources.
 * --pass requires --evidence that CITES at least one non-AI external URL
 * (http/https) with a short excerpt. Optional: --source <url> repeated.
 *
 * Usage:
 *   node validate-research.mjs --status
 *   node validate-research.mjs --id R1 --pass --evidence <path> [--source https://...]
 *   node validate-research.mjs --id R1 --fail --reason "..."
 */
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

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args[i + 1] ?? true;
}
function flags(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith("--")) {
      out.push(args[++i]);
    }
  }
  return out;
}

const statusOnly = args.includes("--status");
const id = flag("--id");
const pass = args.includes("--pass");
const fail = args.includes("--fail");
const evidence = flag("--evidence");
const reason = flag("--reason") || "";
const extraSources = flags("--source");

const researchPath = path.join(paths.runtimeRoot, "validations", "RESEARCH.json");
let research = readJson(researchPath, null);

if (!research) {
  console.log(
    JSON.stringify({
      ok: false,
      error: "Missing RESEARCH.json — run init-run.mjs after PLAN with Recherche subjects",
      expected: researchPath,
    })
  );
  process.exit(2);
}

if (statusOnly) {
  console.log(JSON.stringify({ ok: true, research }, null, 2));
  process.exit(research.allPass ? 0 : 3);
}

if (!id) {
  console.error(JSON.stringify({ ok: false, error: "Need --id R1 or --status" }));
  process.exit(1);
}

const subject = research.subjects.find((s) => s.id === id);
if (!subject) {
  console.error(
    JSON.stringify({
      ok: false,
      error: `Unknown subject ${id}`,
      known: research.subjects.map((s) => s.id),
    })
  );
  process.exit(1);
}

if (pass) {
  if (!evidence || !fs.existsSync(evidence)) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "--pass requires existing --evidence <disk path>",
      })
    );
    process.exit(1);
  }
  const check = assertNonAiSources(evidence, extraSources);
  if (!check.ok) {
    console.error(JSON.stringify({ ok: false, id, ...check }));
    process.exit(4);
  }
  subject.pass = true;
  subject.evidence = evidence;
  subject.sources = check.sources;
  subject.reason = reason || "non-AI sources cited";
  subject.at = new Date().toISOString();
} else if (fail) {
  subject.pass = false;
  subject.evidence = evidence || null;
  subject.sources = [];
  subject.reason = reason || "fail";
  subject.at = new Date().toISOString();
} else {
  console.error(JSON.stringify({ ok: false, error: "Need --pass or --fail" }));
  process.exit(1);
}

research.allPass = research.subjects.length > 0 && research.subjects.every((s) => s.pass);
research.at = new Date().toISOString();
research.rule =
  "Evidence must cite non-AI external http(s) sources. AI-written notes alone = NOT validated.";
writeJson(researchPath, research);

const phasePath = path.join(paths.runtimeRoot, "validations", "PHASE.json");
const phase = readJson(phasePath, {}) || {};
if (research.allPass) {
  phase.phase = "execute-validate";
  phase.researchOk = true;
  phase.needPlan = false;
} else {
  phase.phase = "research";
  phase.researchOk = false;
}
phase.at = new Date().toISOString();
writeJson(phasePath, phase);

const pointsDoc = readJson(paths.points, null);
if (pointsDoc?.points) {
  const pt = pointsDoc.points.find((p) => p.id === id);
  if (pt) {
    pt.pass = subject.pass;
    pt.evidence = subject.evidence;
    pt.sources = subject.sources || [];
  }
  pointsDoc.at = new Date().toISOString();
  writeJson(paths.points, pointsDoc);
}

appendEvent({
  event: pass ? "research-pass" : "research-fail",
  id,
  pointId: id,
  pass: subject.pass,
  evidence: subject.evidence,
  sources: subject.sources || [],
  allPass: research.allPass,
});
appendEvent({
  event: "point-result",
  pointId: id,
  pass: subject.pass,
  evidence: subject.evidence,
  controller: "ctrl-docs",
  note: pass ? "non-AI sources cited" : reason || "research fail",
});

console.log(
  JSON.stringify({
    ok: true,
    id,
    pass: subject.pass,
    sources: subject.sources || [],
    allPass: research.allPass,
    research: researchPath,
    phase: phase.phase,
  })
);

/**
 * Non-AI source = http(s) URL to an external document (official docs, standards, etc.).
 * AI prose under validations/research without URLs → reject.
 */
function assertNonAiSources(evidencePath, cliSources) {
  const text = fs.readFileSync(evidencePath, "utf8");
  const fromFile = extractUrls(text);
  const fromCli = (cliSources || []).filter((u) => /^https?:\/\//i.test(u));
  const all = unique([...fromFile, ...fromCli].map(normalizeUrl).filter(Boolean));

  if (!all.length) {
    return {
      ok: false,
      error:
        "NOT A VALID SOURCE: evidence has zero http(s) URLs. AI-written notes are not sources. Cite Source: https://... (non-AI) or pass --source <url>.",
      code: "AI_ONLY_EVIDENCE",
    };
  }

  const blocked = all.filter(isBlockedAsAiOrSelf);
  const okUrls = all.filter((u) => !isBlockedAsAiOrSelf(u));
  if (!okUrls.length) {
    return {
      ok: false,
      error:
        "NOT A VALID SOURCE: only self/AI/local artefact URLs found. Need external non-AI docs.",
      blocked,
      code: "NO_EXTERNAL_SOURCE",
    };
  }

  // Require explicit Source/Doc line OR --source, to avoid accidental URL paste without citation intent
  const cited =
    /(^|\n)\s*(Source|Doc|URL|Documentation)\s*:/i.test(text) ||
    fromCli.length > 0;
  if (!cited) {
    return {
      ok: false,
      error:
        "Evidence must label citations as Source: https://... (or pass --source). Naked AI essay with random links rejected.",
      urls: okUrls,
      code: "UNLABELED_URLS",
    };
  }

  // Require a short excerpt near a source (quote or Extrait)
  const hasExcerpt =
    /Extrait\s*:/i.test(text) ||
    /Quote\s*:/i.test(text) ||
    /«[^»]{12,}»/.test(text) ||
    /"[^"]{12,}"/.test(text);
  if (!hasExcerpt) {
    return {
      ok: false,
      error:
        "Each non-AI source needs an Extrait:/Quote: (verbatim snippet from that page). URL alone is not enough.",
      urls: okUrls,
      code: "NO_EXCERPT",
    };
  }

  return { ok: true, sources: okUrls };
}

function extractUrls(text) {
  const re = /https?:\/\/[^\s\)\]\>\"'<>]+/gi;
  return [...text.matchAll(re)].map((m) => m[0].replace(/[.,;:]+$/, ""));
}

function normalizeUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== "http:" && x.protocol !== "https:") return null;
    return x.href;
  } catch {
    return null;
  }
}

function isBlockedAsAiOrSelf(u) {
  let host = "";
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    return true;
  }
  // Local / orchestration artefacts are not external sources
  if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return true;
  // file paths wrongly parsed
  if (u.toLowerCase().includes("orchestration/wsai-loop/validations")) return true;
  return false;
}

function unique(arr) {
  return [...new Set(arr)];
}
