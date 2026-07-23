---
name: wsai-loop-cancel
description: "Set ACTIVE=false to stop FORCE_CONTINUE."
---

# /wsai-loop-cancel

Write `validations/ACTIVE.json`:

```json
{ "active": false, "cancelledAt": "<ISO>", "cancelledBy": "user" }
```

Keep BOARD/POINTS history.
