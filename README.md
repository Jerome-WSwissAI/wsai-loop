# wsai-loop

State a goal. Parallel agents research it from non-AI sources, build it as
independent workstreams, review it, and loop until the board passes. Done means
one shot: a complete, tested project.

## Flow

1. Plan — `wsai-planner` cites official sources, writes `PLAN.md`, and splits
   the work into workstreams with disjoint owned paths.
2. Research (parallel) — one agent per subject collects `Source:` + `Extrait:`;
   `ctrl-docs` validates each. AI notes are not sources.
3. Build (parallel) — one `wsai-builder` per workstream in each dependency
   batch, running at the same time on paths that never overlap.
4. Integrate — `wsai-integrator` wires the workstreams and proves the whole
   project builds and tests pass.
5. Review (parallel) — `ctrl-docs`, `ctrl-divergence`, `ctrl-hostile`, and
   `ctrl-lexeme` check their dimensions together.
6. Converge — `board.mjs` computes `allPass`. If not, a fixer per missing point
   runs and the loop continues. The Stop hook forces continuation.

## Install

Claude Code (agents, commands, hooks under `.claude-plugin/`):

```bash
git clone https://github.com/Jerome-WSwissAI/wsai-loop.git
```

Add the clone with `/plugin` or a marketplace entry. See
https://code.claude.com/docs/en/plugins

Cursor (`.cursor-plugin/`):

```bash
git clone https://github.com/Jerome-WSwissAI/wsai-loop.git ~/.cursor/plugins/local/wsai-loop
```

See https://cursor.com/docs/plugins and https://cursor.com/docs/hooks

## Use

```
/wsai-loop <goal>
```

From zero:

```bash
node scripts/scaffold-project.mjs --name my-app [--out <dir>]
```

Runtime state: `WSAI_LOOP_ROOT`, or `PROJECT_ROOT/.wsai-loop`, or `./.wsai-loop`.
Cancel with `/wsai-loop-cancel`.

## License

MIT
