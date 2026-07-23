---
name: wsai-loop
description: "Goal to research (non-AI sources) to todolist validated to one-shot."
argument-hint: "what to automate until complete"
---

# /wsai-loop

You state only the goal. Realization = one-shot (no return).

`$ARGUMENTS` = goal.

## Single install

One plugin path: `~/.cursor/plugins/local/wsai-loop`  
One slash command: `/wsai-loop` (+ `/wsai-loop-cancel`).

```bash
git clone https://github.com/Jerome-WSwissAI/wsai-loop.git ~/.cursor/plugins/local/wsai-loop
```

Runtime: `WSAI_LOOP_ROOT` or `./.wsai-loop`.

## Flow

1. `CURRENT.md` → `PLAN.md`
2. `init-run.mjs` → RESEARCH + `generate-todos.mjs` → `TODO.md`
3. Each R*: `Source:` + `Extrait:` (non-AI) → `validate-research.mjs`
4. Each TD*: `validate-todo.mjs`
5. `board.mjs` — done only if all pass

Hooks: https://cursor.com/docs/hooks
