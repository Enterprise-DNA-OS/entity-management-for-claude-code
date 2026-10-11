---
description: Show each staff member's late and due items for the next N days (default 30).
---

Read CLAUDE.md first.

```bash
npm run entities -- workload --days=30
```

One line per staff member.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
