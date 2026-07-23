---
name: wsai-loop
description: "Goal → non-AI research → todos → lexeme → one-shot."
argument-hint: "goal to automate until perfect"
---

# /wsai-loop

State the goal only. Done = one-shot, no return.

`$ARGUMENTS` = goal.

## Install

`~/.cursor/plugins/local/wsai-loop`  
Clone: https://github.com/Jerome-WSwissAI/wsai-loop  
Cursor manifest: `.cursor-plugin/`. Claude Code: `.claude-plugin/`.  
No duplicate user skill. Runtime: `WSAI_LOOP_ROOT` or `./.wsai-loop`.

## Flow

1. `CURRENT.md` → `PLAN.md`
2. `init-run.mjs` → RESEARCH + todos
3. R*: `Source:` + `Extrait:` → `validate-research.mjs`
4. TD*: `validate-todo.mjs`
5. `validate-lexeme.mjs` — every character/word must earn its place
6. Controllers + `board.mjs` — loop via stop until allPass

Hooks: https://cursor.com/docs/hooks  
Cancel: `/wsai-loop-cancel`
