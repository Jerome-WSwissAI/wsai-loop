#!/usr/bin/env node
/**
 * Validate one TODO. AI-only evidence rejected.
 *   node validate-todo.mjs --id TD1 --pass --evidence <path> [--source https://…]
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
    if (args[i] === name && args[i + 1] && !String(args[i + 1]).startsWith("--")) {
      out.push(args[++i]);
    }
  }
  return out;
}

const todosPath = path.join(paths.runtimeRoot, "validations", "TODOS.json");
const todoMdPath = path.join(paths.runtimeRoot, "prompts", "TODO.md");
const statusOnly = args.includes("--status");
const id = flag("--id");
const pass = args.includes("--pass");
const fail = args.includes("--fail");
const evidence = flag("--evidence");
const reason = flag("--reason") || "";
const extraSources = flags("--source");

const todos = readJson(todosPath, null);
if (!todos?.items?.length) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "No TODOS.json — run generate-todos.mjs after PLAN/research",
    })
  );
  process.exit(2);
}

if (statusOnly) {
  console.log(JSON.stringify({ ok: true, todos }, null, 2));
  process.exit(todos.allPass ? 0 : 3);
}

const item = todos.items.find((t) => t.id === id);
if (!item) {
  console.error(
    JSON.stringify({
      ok: false,
      error: `Unknown ${id}`,
      known: todos.items.map((t) => t.id),
    })
  );
  process.exit(1);
}

if (pass) {
  if (!evidence || !fs.existsSync(evidence)) {
    console.error(JSON.stringify({ ok: false, error: "--pass needs --evidence path" }));
    process.exit(1);
  }
  const check = checkSources(evidence, extraSources);
  if (!check.ok) {
    console.error(JSON.stringify({ ok: false, id, ...check }));
    process.exit(4);
  }
  item.pass = true;
  item.evidence = evidence;
  item.sources = check.sources;
  item.reason = reason || "todo validated";
  item.at = new Date().toISOString();
} else if (fail) {
  item.pass = false;
  item.evidence = evidence || null;
  item.reason = reason || "fail";
  item.at = new Date().toISOString();
} else {
  console.error(JSON.stringify({ ok: false, error: "Need --pass or --fail" }));
  process.exit(1);
}

todos.allPass = todos.items.every((t) => t.pass);
todos.at = new Date().toISOString();
writeJson(todosPath, todos);
fs.writeFileSync(
  todoMdPath,
  [
    `# TODO`,
    `allPass: ${todos.allPass}`,
    ``,
    ...todos.items.map(
      (t) =>
        `- [${t.pass ? "x" : " "}] ${t.id} (${t.from}) ${t.text}` +
        (t.evidence ? ` — ${t.evidence}` : "")
    ),
    ``,
  ].join("\n"),
  "utf8"
);

appendEvent({
  event: pass ? "todo-pass" : "todo-fail",
  id,
  pass: item.pass,
  evidence: item.evidence,
  sources: item.sources || [],
});
appendEvent({
  event: "point-result",
  pointId: id,
  pass: item.pass,
  evidence: item.evidence,
  controller: "ctrl-hostile",
  note: pass ? "todo validated" : reason,
});

console.log(
  JSON.stringify({
    ok: true,
    id,
    pass: item.pass,
    allPass: todos.allPass,
    todos: todosPath,
  })
);

function checkSources(evidencePath, cliSources) {
  const text = fs.readFileSync(evidencePath, "utf8");
  const re = /https?:\/\/[^\s\)\]\>\"'<>]+/gi;
  const fromFile = [...text.matchAll(re)].map((m) => m[0].replace(/[.,;:]+$/, ""));
  const fromCli = (cliSources || []).filter((u) => /^https?:\/\//i.test(u));
  const all = [...new Set([...fromFile, ...fromCli])];
  if (!all.length) {
    return {
      ok: false,
      code: "AI_ONLY_EVIDENCE",
      error: "AI notes are not sources. Need Source: https://… + Extrait: (or deliverable + --source)",
    };
  }
  const cited =
    /(^|\n)\s*(Source|Doc|URL|Documentation)\s*:/i.test(text) || fromCli.length > 0;
  if (!cited) {
    return { ok: false, code: "UNLABELED_URLS", error: "Label Source: https://…" };
  }
  const hasExcerpt =
    /Extrait\s*:/i.test(text) ||
    /Quote\s*:/i.test(text) ||
    /«[^»]{12,}»/.test(text) ||
    /"[^"]{12,}"/.test(text);
  if (!hasExcerpt) {
    return { ok: false, code: "NO_EXCERPT", error: "Need Extrait: verbatim" };
  }
  return { ok: true, sources: all };
}
