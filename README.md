# wsai-loop

Cursor plugin: you state the **goal**; the system researches with **non-AI sources**, builds a **todolist from research**, validates **every** item, then finishes **one-shot**.

## Install

```bash
git clone https://github.com/Jerome-WSwissAI/wsai-loop.git ~/.cursor/plugins/local/wsai-loop
```

Reload Cursor window. Enable the plugin under Customize.

Optional runtime dir:

```bash
export WSAI_LOOP_ROOT=/path/to/runtime   # else ./.wsai-loop
```

## Usage

```
/wsai-loop
je veux X jusqu'à réalisation complète
```

## Rules

- Sources = `Source: https://…` + `Extrait:` (official docs). AI essays ≠ sources.
- `generate-todos.mjs` builds `TODOS.json` from PLAN + research `## Todos`.
- Every `TD*` must `validate-todo.mjs --pass` before BOARD allPass.
- One slash command only (`/wsai-loop`).

## Docs (non-AI)

- https://cursor.com/docs/plugins
- https://cursor.com/docs/reference/plugins
- https://cursor.com/docs/hooks

## License

MIT
