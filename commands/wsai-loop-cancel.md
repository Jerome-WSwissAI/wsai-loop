---
name: wsai-loop-cancel
description: "Désarme la boucle wsai-loop (ACTIVE=false) pour arrêter FORCE_CONTINUE"
---

# /wsai-loop-cancel

Écris `E:\WSAI\Orchestration\wsai-loop\validations\ACTIVE.json` avec:

```json
{ "active": false, "cancelledAt": "<ISO>", "cancelledBy": "jerome" }
```

Puis confirme le chemin. N'efface pas BOARD/POINTS (historique).
