---
name: wsai-loop
description: "But → recherches (sources non-IA) → todolist → tout validé → one-shot."
argument-hint: "ce qui doit être automatisé jusqu'à réalisation complète"
---

# /wsai-loop

## Contrat

Tu dis **seulement** le but à automatiser jusqu’à **réalisation complète** (plus besoin de revenir).

`$ARGUMENTS` = le but brut.

## Une seule commande

Ce plugin expose **un** slash : `/wsai-loop` (+ `/wsai-loop-cancel`). Pas de skill doublon.

## Install public

Repo GitHub (clone → `~/.cursor/plugins/local/wsai-loop`).  
Runtime: env `WSAI_LOOP_ROOT` ou `./.wsai-loop` (legacy `E:\WSAI\Orchestration\wsai-loop` si présent).

## Protocole

1. `prompts/CURRENT.md` = but  
2. `prompts/PLAN.md` = Recherche + Plan + Exercices + F/T/Q/But  
3. `init-run.mjs` → RESEARCH + **generate-todos.mjs** → `TODOS.json` / `TODO.md`  
4. Chaque `R*` : `Source: https://…` + `Extrait:` (non-IA) → `validate-research.mjs`  
5. Evidence research peut contenir `## Todos` → regénérer todolist  
6. **Chaque `TD*`** → `validate-todo.mjs --pass --evidence` (mêmes règles sources)  
7. Controllers + `board.mjs` — done seulement si RESEARCH + **tous les todos** + F/T/Q/GOAL  

Hook `preToolUse` deny tant que research incomplete. https://cursor.com/docs/hooks  
Hook `stop` FORCE si todos incomplets.

## Cancel

`/wsai-loop-cancel`
