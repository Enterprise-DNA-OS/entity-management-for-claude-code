---
description: Record a filing: annual return, ASIC review fee paid, annual statement checked, address or name change.
---

Read CLAUDE.md first.

```bash
npm run entities -- file --entity="Kauri Orchards" --kind=annual-return --reference=AR-5730114 --date=2026-10-12 --actor="<operator>"
```

Kinds: annual-return (NZ), annual-review-fee and statement-checked (AU), address-change, name-change, constitution, other. Record only what has been lodged or paid.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
