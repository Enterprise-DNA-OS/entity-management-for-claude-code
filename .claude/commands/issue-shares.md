---
description: Issue shares to a holder and show the notice deadline.
---

Read CLAUDE.md first.

```bash
npm run entities -- issue-shares --entity="Rimu Freight Limited" --to="Hemi Rawiri" --quantity=1500 --class=ORD --amount=150000 --date=2026-10-07 --actor="<operator>"
```

Read it back and wait for a yes. Show the new register and the notice deadline.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
