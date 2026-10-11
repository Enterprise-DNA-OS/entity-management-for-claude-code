---
description: Show every company a person or trust is a director, secretary or shareholder of, including through other companies.
---

Read CLAUDE.md first.

```bash
npm run entities -- person "Grace Liu"
```

Answer "what does this person hold" in one line first: how many offices, how many direct holdings, how many through companies.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
