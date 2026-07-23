---
name: wsai-loop
description: "Goal to a complete, tested project built by parallel agents. Research, build, review, converge until one-shot done."
argument-hint: "the goal to build until the board passes"
---

# /wsai-loop

Build the whole goal with parallel agents and do not stop until the BOARD
passes. `$ARGUMENTS` is the goal. Never ask the user to reframe.

Scripts live at `${CLAUDE_PLUGIN_ROOT}/scripts`. Runtime state lives at
`WSAI_LOOP_ROOT` or `./.wsai-loop`. Pass the absolute scripts path to every
subagent you spawn.

## 0. Bootstrap

1. From zero: `node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold-project.mjs" --name <app> [--out <dir>]`,
   then set `WSAI_LOOP_ROOT` to that project's `.wsai-loop`.
2. Write `$ARGUMENTS` into `prompts/CURRENT.md` under `## Besoin`.

## 1. Plan

Spawn one `wsai-planner`. It cites non-AI sources, writes `prompts/PLAN.md`,
and authors `validations/WORKSTREAMS.json` with disjoint `owns` paths.
Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/init-run.mjs"`. If it returns
`needPlan`, the plan is incomplete — send the planner back.

## 2. Research in parallel

The pre-tool gate blocks source writes until research passes. In ONE message,
launch one subagent per `R*` subject (concurrent). Each returns
`Source: https://…` and `Extrait:` from an official page into
`validations/research/`. Then, again in parallel, `ctrl-docs` validates each:
`node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-research.mjs" --id R<n> --pass --evidence <path>`.
No AI notes as sources.

## 3. Build in parallel

Read `validations/WORKSTREAMS.json`. For each entry in `batches` (in order):
in ONE message, launch one `wsai-builder` per `WS*` in that batch. They run at
the same time on disjoint owned paths. For overlapping or risky paths, give the
builder worktree isolation. Each builder tests its unit and calls
`validate-point.mjs --id WS<n> --pass true --evidence <path> --controller ctrl-divergence`.
Move to the next batch once the current batch's points pass.

## 4. Integrate

Spawn one `wsai-integrator`. It wires the workstreams together and proves the
whole project builds and every test passes from a clean checkout, with the
command output saved to `validations/research/INTEGRATION.md`.

## 5. Review in parallel

In ONE message, launch `ctrl-docs`, `ctrl-divergence`, `ctrl-hostile`, and
`ctrl-lexeme` together. Each reviews its dimension and validates or fails its
points with disk evidence. Also run
`node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-lexeme.mjs" --root "${CLAUDE_PLUGIN_ROOT}"`.

## 6. Converge

`node "${CLAUDE_PLUGIN_ROOT}/scripts/board.mjs"`. If `allPass`, done — state the
BOARD path. Else, in parallel, dispatch a fixer per missing point
(`R*`/`TD*`/`WS*`/`F*`/`T*`/`Q*`/`LEXEME`/`GOAL`), then loop from the phase that
owns the gap. The Stop hook forces continuation until `allPass`.

Cancel: `/wsai-loop-cancel`.
