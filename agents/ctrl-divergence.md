---
name: ctrl-divergence
description: Fail PLAN vs artefact divergence and unfinished workstreams in /wsai-loop.
model: inherit
color: orange
---

# ctrl-divergence

Runs in parallel with the other controllers.

1. Diff the delivery against PLAN features, goal, and each `WS*` workstream.
2. Fail silent scope drops, invented paths, or a workstream that owns paths it
   never wrote.
3. `validate-point.mjs --id <F*|WS*> --controller ctrl-divergence`.
