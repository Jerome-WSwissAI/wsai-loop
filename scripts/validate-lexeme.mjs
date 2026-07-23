#!/usr/bin/env node
/**
 * Lexeme gate: every kept character/word in scoped files must earn its place.
 * Fail on banned fluff, empty decoration, or lines with no role.
 *
 *   node validate-lexeme.mjs [--root <pluginRoot>] [--fix]
 *   node validate-lexeme.mjs --evidence-out <path>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    appendEvent,
    ensureRuntimeDirs,
    paths,
    writeJson,
} from "./paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args[i + 1] ?? true;
}

const root = path.resolve(flag("--root") || paths.pluginRoot);
const evidenceOut =
  flag("--evidence-out") ||
  path.join(paths.runtimeRoot, "validations", "research", "LEXEME.md");

const BANNED = [
  /\bJerome\b/i,
  /\bralph\b/i,
  /Frame Translator/i,
  /ne remplit pas/i,
  /But\s*\/\s*Mani[eè]re/i,
  /ValidationGoal/i,
  /confirmation list/i,
  /laisser .* croire/i,
  /\bTODO:\s*(fix later|hack|temp|xxx)/i,
  /\blorem\b/i,
  /\bplaceholder\b/i,
  /\bfoo\b|\bbar\b|\bbaz\b/i,
];

const SKIP_DIR = new Set([
  ".git",
  "node_modules",
  "validations",
  ".wsai-loop",
]);
const SCAN_EXT = new Set([".md", ".json", ".mjs"]);

const fails = [];
const scanned = [];

walk(root);
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (SCAN_EXT.has(path.extname(ent.name))) scanFile(p);
  }
}

function scanFile(file) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  // skip LICENSE legalese (required by MIT, not fluff)
  if (rel === "LICENSE") return;
  const text = fs.readFileSync(file, "utf8");
  scanned.push(rel);
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    // enforcer file may contain ban patterns as data
    if (rel !== "scripts/validate-lexeme.mjs") {
      for (const re of BANNED) {
        if (!re.test(line)) continue;
        // allow GitHub owner Jerome-WSwissAI in clone URLs
        if (/\bJerome\b/i.test(line) && /Jerome-WSwissAI|github\.com\/Jerome-/i.test(line)) {
          continue;
        }
        fails.push({
          file: rel,
          line: n,
          reason: `banned pattern ${re}`,
          excerpt: line.trim().slice(0, 120),
        });
      }
    }
    // decorative-only lines (not YAML frontmatter fences)
    if (
      /^\s*[-=_*~]{3,}\s*$/.test(line) &&
      !rel.endsWith(".mjs") &&
      !(line.trim() === "---" && (i === 0 || lines.slice(0, i).every((l) => l.trim() === "" || l.trim() === "---" || /^[\w-]+:/.test(l) || l.trim() === "---")))
    ) {
      // allow --- that open/close YAML frontmatter (first fence and matching close before body)
      const trimmed = line.trim();
      if (trimmed === "---") {
        const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
        if (fm) {
          const fmLines = fm[0].split(/\r?\n/).length;
          if (n <= fmLines) continue;
        }
      }
      fails.push({
        file: rel,
        line: n,
        reason: "decorative rule with no semantic role",
        excerpt: line.trim(),
      });
    }
    // empty emphasis / emoji spam
    if (/[\u{1F300}-\u{1FAFF}]/u.test(line)) {
      fails.push({
        file: rel,
        line: n,
        reason: "emoji without functional role",
        excerpt: line.trim().slice(0, 80),
      });
    }
  }

  // file-level: frontmatter description must not be empty marketing
  if (rel.endsWith(".md") && /^---\n/.test(text)) {
    const desc = text.match(/^description:\s*[>"']?\s*(.+)$/m);
    if (desc && /just|awesome|simply|easily|powerful/i.test(desc[1])) {
      fails.push({
        file: rel,
        line: 1,
        reason: "marketing fluff in description",
        excerpt: desc[1].slice(0, 80),
      });
    }
  }
}

ensureRuntimeDirs();
const pass = fails.length === 0;
const report = {
  at: new Date().toISOString(),
  root,
  pass,
  scanned: scanned.length,
  fails,
  rule: "Every kept character/word must have a role. Banned fluff → fail. ctrl-lexeme.",
};

writeJson(path.join(paths.runtimeRoot, "validations", "LEXEME.json"), report);

const md = [
  `# LEXEME`,
  `pass: ${pass}`,
  `scanned: ${scanned.length}`,
  ``,
  `Source: https://cursor.com/docs/reference/plugins`,
  `Extrait: "Commands support YAML frontmatter" — keep only fields that load.`,
  ``,
  `## Fails`,
  ...(fails.length
    ? fails.map(
        (f) =>
          `- ${f.file}:${f.line} — ${f.reason} — \`${(f.excerpt || "").replace(/`/g, "'")}\``
      )
    : [`- none`]),
  ``,
  `## Todos`,
  ...fails.map(
    (f) => `- [ ] Remove or justify: ${f.file}:${f.line} (${f.reason})`
  ),
  ``,
].join("\n");
fs.mkdirSync(path.dirname(evidenceOut), { recursive: true });
fs.writeFileSync(evidenceOut, md, "utf8");

appendEvent({
  event: "lexeme",
  pass,
  fails: fails.length,
  evidence: evidenceOut,
});

console.log(
  JSON.stringify({
    ok: pass,
    pass,
    fails: fails.length,
    evidence: evidenceOut,
    lexeme: path.join(paths.runtimeRoot, "validations", "LEXEME.json"),
  })
);
process.exit(pass ? 0 : 4);
