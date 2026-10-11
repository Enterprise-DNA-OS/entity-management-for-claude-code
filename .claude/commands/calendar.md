---
description: List every deadline in the next N days (default 60), nearest first.
---

Read CLAUDE.md first.

```bash
npm run entities -- calendar --days=60
```

A dated list, nearest first. Negative days left are already late.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
