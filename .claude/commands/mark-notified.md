---
description: Record that a change was filed with the Companies Office or ASIC.
---

Read CLAUDE.md first.

```bash
npm run entities -- mark-notified --id=b0000007 --date=2026-10-12 --actor="<operator>"
```

Run notices first for the id. Record only once the filing is actually lodged. Say if it was late and by how many days.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
