#!/usr/bin/env node
/**
 * Generate TODO list from PLAN + research evidence.
 * Todos from research must all be validated before BOARD allPass.
 *
 *   node generate-todos.mjs
 *   node generate-todos.mjs --status
 */
import fs from "node:fs";
import path from "node:path";
import {
    appendEvent,
    bulletsFrom,
    ensureRuntimeDirs,
    extractSection,
    paths,
    readJson,
    writeJson,
} from "./paths.mjs";

ensureRuntimeDirs();

const todosPath = path.join(paths.runtimeRoot, "validations", "TODOS.json");
const todoMdPath = path.join(paths.runtimeRoot, "prompts", "TODO.md");
const researchDir = path.join(paths.runtimeRoot, "validations", "research");
const statusOnly = process.argv.includes("--status");

const prev = readJson(todosPath, { items: [] });
const prevByKey = new Map(
  (prev.items || []).map((t) => [keyOf(t), t])
);

const items = [];
let nextId = 1;
for (const t of prev.items || []) {
  const m = String(t.id || "").match(/^TD(\d+)$/);
  if (m) nextId = Math.max(nextId, Number(m[1]) + 1);
}

function pushTodo({ text, from, ref, linkedResearch }) {
  text = String(text || "")
    .replace(/^\[.\]\s*/, "")
    .trim();
  if (text.length < 4) return;
  const k = `${from}::${text}`;
  const old = prevByKey.get(k);
  const id = old?.id && /^TD\d+$/.test(old.id) ? old.id : `TD${nextId++}`;
  items.push({
    id,
    text,
    from,
    ref: ref || null,
    linkedResearch: linkedResearch || null,
    pass: old?.pass === true,
    evidence: old?.evidence || null,
    sources: old?.sources || [],
    at: old?.at || null,
  });
}

// From PLAN.md — Plan steps + exercices
if (fs.existsSync(paths.planMd)) {
  const md = fs.readFileSync(paths.planMd, "utf8");
  const planSec = extractSection(md, ["Plan", "Etapes", "Étapes"]);
  const steps = planSec.split(/^###\s+/m).filter(Boolean);
  for (const part of steps) {
    const title = part.split(/\r?\n/)[0]?.trim() || "etape";
    const faire =
      part.match(/^\s*[-*]?\s*Faire\s*:\s*(.+)$/im)?.[1]?.trim() ||
      title.replace(/^Etape\s*\d+\s*:?\s*/i, "").trim();
    if (faire && faire.length > 3) {
      pushTodo({
        text: faire,
        from: "plan",
        ref: title.slice(0, 80),
      });
    }
  }
  const ex = extractSection(md, [
    "Validation avant livraison",
    "Exercices",
  ]);
  for (const b of bulletsFrom(ex)) {
    pushTodo({ text: b, from: "exercice", ref: "validation-livraison" });
  }
}

// From research evidence — ## Todos / - [ ] lines (research-generated)
if (fs.existsSync(researchDir)) {
  for (const f of fs.readdirSync(researchDir)) {
    if (!/\.(md|txt)$/i.test(f)) continue;
    const p = path.join(researchDir, f);
    const text = fs.readFileSync(p, "utf8");
    const todoSec = extractSection(text, ["Todos", "Todo", "Actions", "Checklist"]);
    const fromSec = new Set(bulletsFrom(todoSec));
    const fromBoxes = text
      .split(/\r?\n/)
      .filter((l) => /^[-*]\s*\[[ x]\]\s+/i.test(l))
      .map((l) => l.replace(/^[-*]\s*\[[ x]\]\s+/i, "").trim())
      .filter((l) => l.length >= 4 && !fromSec.has(l));
    for (const line of [...fromSec, ...fromBoxes]) {
      pushTodo({
        text: line,
        from: "research",
        ref: f,
      });
    }
  }
}

const research = readJson(
  path.join(paths.runtimeRoot, "validations", "RESEARCH.json"),
  null
);
if (research?.subjects) {
  for (const s of research.subjects) {
    pushTodo({
      text: `Valider recherche ${s.id}: ${s.title}`,
      from: "research-gate",
      ref: s.id,
      linkedResearch: s.id,
    });
  }
}

const allPass = items.length > 0 && items.every((t) => t.pass);
const doc = {
  at: new Date().toISOString(),
  allPass,
  rule: "Todolist generated from PLAN + research. Every TD* must pass before realization.",
  items,
};

if (statusOnly) {
  console.log(JSON.stringify({ ok: true, todos: doc }, null, 2));
  process.exit(allPass ? 0 : 3);
}

writeJson(todosPath, doc);

const md = [
  `# TODO — généré par recherches / plan`,
  ``,
  `allPass: ${allPass}`,
  ``,
  ...items.map(
    (t) =>
      `- [${t.pass ? "x" : " "}] ${t.id} (${t.from}) ${t.text}` +
      (t.evidence ? ` — ${t.evidence}` : "")
  ),
  ``,
  `Valider: node scripts/validate-todo.mjs --id TD1 --pass --evidence <path> [--source https://…]`,
  ``,
].join("\n");
fs.writeFileSync(todoMdPath, md, "utf8");

appendEvent({
  event: "generate-todos",
  count: items.length,
  allPass,
  fromResearch: items.filter((t) => t.from.startsWith("research")).length,
});

console.log(
  JSON.stringify({
    ok: true,
    count: items.length,
    allPass,
    todos: todosPath,
    todoMd: todoMdPath,
  })
);

function keyOf(t) {
  return `${t.from}::${t.text}`;
}
