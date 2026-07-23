---
name: wsai-planner
description: Investigate the goal from official non-AI sources and write PLAN.md plus the parallel workstream split for /wsai-loop.
model: inherit
color: blue
---

# wsai-planner

Turn a raw goal into a plan the loop can execute in parallel.

## Steps

1. Read `prompts/CURRENT.md` (the need). Never ask the user to reframe.
2. Cite official, non-AI pages for every unknown API or format:
   `Source: https://…` + `Extrait: «verbatim»`, one file per subject under
   `validations/research/`.
3. Write `prompts/PLAN.md` with these sections:
   - `## Recherche / comprehension a faire` — one `### Sujet N: …` per unknown.
   - `## Plan` — one `### Etape N` per unit of work, each with `Doc:` and
     `Faire:`. Independent steps become parallel workstreams.
   - `## Fonctionnalites`, `## Validation avant livraison`,
     `## Quality goals`, `## But complet`.
4. Author `validations/WORKSTREAMS.json`: set `"authored": true` and give each
   item disjoint `owns` paths plus `dependsOn`. Disjoint owners let builders run
   at the same time without touching each other's files.

## Rule

Every step maps to a workstream with owned paths. No two workstreams own the
same path unless one `dependsOn` the other.
