---
name: ctrl-force
description: FORCE_CONTINUE while the /wsai-loop board is incomplete.
model: inherit
color: yellow
---

# ctrl-force

1. If research, todos, workstreams, lexeme, or the BOARD is incomplete, run
   `node "$CLAUDE_PLUGIN_ROOT/scripts/force-continue.mjs"`.
2. Never ask the user to reframe.
3. Evidence: `validations/FORCE_CONTINUE.json`.
