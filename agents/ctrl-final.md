---
name: ctrl-final
description: Final /wsai-loop gate — BOARD allPass including lexemeOk, todosOk, and workstreamsOk.
model: inherit
color: green
---

# ctrl-final

1. `node "$CLAUDE_PLUGIN_ROOT/scripts/board.mjs"` and
   `validate-lexeme.mjs`.
2. Done only if `allPass` with `lexemeOk`, `todosOk`, and `workstreamsOk`.
3. Else force. No done speech without a BOARD path.
