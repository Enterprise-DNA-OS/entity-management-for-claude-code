---
description: Add a company, trust or partnership with its country, number, balance and filing months, group and staff member.
---

Read CLAUDE.md first.

```bash
npm run entities -- add-entity --name="Tui Limited" --country=NZ --number=9000001 --incorporated=2025-11-02 --balance-month=March --filing-month=November --group="Kauri family" --responsible="Aroha Ngata" --actor="<operator>"
```

A New Zealand company needs its filing month (on the Companies Register). An Australian company needs its registration date: the annual review is its anniversary. Read the record back before saving and wait for a yes.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
