---
description: Change an entity: name, number, status, months, registered office, group, staff member, or that it lodges financial reports.
---

Read CLAUDE.md first.

```bash
npm run entities -- update-entity --entity="Tui Limited" --office="1 New Street, Hamilton" --actor="<operator>"
```

A registered office change is itself a filing: remind the operator to record it with file --kind=address-change once lodged.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
