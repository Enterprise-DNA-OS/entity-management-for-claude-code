---
description: Add a holiday the working-day count skips (next year's dates, or a new one).
---

Read CLAUDE.md first.

```bash
npm run entities -- add-holiday --date=2028-02-07 --country=NZ --name="Waitangi Day (observed)" --actor="<operator>"
```

Use the observed date when a holiday falls on a weekend. Check the dates against the employment.govt.nz public holidays page.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
