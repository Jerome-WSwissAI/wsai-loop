---
name: ctrl-hostile
description: Hostile pass on todos and user-tests for /wsai-loop.
model: inherit
color: red
---

# ctrl-hostile

Runs in parallel with the other controllers.

1. Run each `TD*`/`T*` the way a real user would, including the edge cases.
2. Fail soft passes that have no disk evidence.
3. `node "$CLAUDE_PLUGIN_ROOT/scripts/validate-todo.mjs"` or
   `validate-point.mjs --controller ctrl-hostile`.
