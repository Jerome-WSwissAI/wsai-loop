#!/usr/bin/env node
/**
 * Create a project from zero under --out (default cwd).
 * Source layout ideas: https://cursor.com/docs/reference/plugins
 *
 *   node scaffold-project.mjs --name my-app [--out <dir>]
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function flag(n) {
  const i = args.indexOf(n);
  return i < 0 ? null : args[i + 1];
}

const name = flag("--name");
const outParent = path.resolve(flag("--out") || process.cwd());
if (!name || !/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Need --name kebab-or-simple (alnum._-)",
    })
  );
  process.exit(1);
}

const root = path.join(outParent, name);
if (fs.existsSync(root) && fs.readdirSync(root).length) {
  console.error(JSON.stringify({ ok: false, error: "target not empty", root }));
  process.exit(2);
}

const dirs = [
  "src",
  "docs",
  "tests",
  ".wsai-loop/prompts",
  ".wsai-loop/validations/research",
];
for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true });

const files = {
  "README.md": `# ${name}\n\nCreated by wsai-loop scaffold-project.\n\nRuntime: \`.wsai-loop/\` (set WSAI_LOOP_ROOT if needed).\n`,
  ".gitignore": `node_modules/\n.wsai-loop/validations/\n.env\nDist/\ndist/\n`,
  "docs/OBJECTIVE.md": `# Objective\n\nFill via /wsai-loop CURRENT.md / PLAN.md.\n`,
  ".wsai-loop/prompts/CURRENT.md": `## Besoin\nCréer et livrer ${name} depuis 0.\n\ndiscussionId: scaffold-${name}\n`,
  "package.json": JSON.stringify(
    {
      name,
      version: "0.0.1",
      private: true,
      type: "module",
      scripts: { test: 'node -e "console.log(\'ok\')"' },
    },
    null,
    2
  ) + "\n",
};

for (const [rel, body] of Object.entries(files)) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, "utf8");
}

const evidence = {
  at: new Date().toISOString(),
  root,
  dirs,
  files: Object.keys(files),
  Source: "https://cursor.com/docs/reference/plugins",
  Extrait:
    "A plugin is a directory with a manifest file and your plugin assets",
};

fs.writeFileSync(
  path.join(root, ".wsai-loop/validations/research/SCAFFOLD.md"),
  [
    `# SCAFFOLD ${name}`,
    `Source: https://cursor.com/docs/reference/plugins`,
    `Extrait: « A plugin is a directory with a manifest file and your plugin assets »`,
    ``,
    `root: ${root}`,
    ``,
    `## Todos`,
    `- [ ] Remplir OBJECTIVE.md / PLAN via /wsai-loop`,
    `- [ ] Ajouter code sous src/`,
    `- [ ] Preuves research non-IA + validate-todo`,
    ``,
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({ ok: true, root, evidence }, null, 2));
