---
name: wsai-loop
description: "Goal → scaffold from zero → non-AI research → todos → lexeme → one-shot."
argument-hint: "goal to automate until perfect"
---

# /wsai-loop

State the goal only. Done = one-shot.

`$ARGUMENTS` = goal.

## Install

`~/.cursor/plugins/local/wsai-loop`  
https://github.com/Jerome-WSwissAI/wsai-loop  
`.cursor-plugin/` Cursor · `.claude-plugin/` Claude Code  
Runtime: `WSAI_LOOP_ROOT` or `./.wsai-loop`

## Flow

1. `CURRENT.md` → `PLAN.md`
2. From zero: `node scripts/scaffold-project.mjs --name <app> [--out <dir>]`
3. `init-run.mjs` → RESEARCH + todos
4. R*: `Source:` + `Extrait:` → `validate-research.mjs`
5. TD*: `validate-todo.mjs`
6. `validate-lexeme.mjs`
7. Controllers + `board.mjs` — stop loops until allPass

Hooks: https://cursor.com/docs/hooks  
Cancel: `/wsai-loop-cancel`
