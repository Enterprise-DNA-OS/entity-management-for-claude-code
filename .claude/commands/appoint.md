---
description: Appoint a director or secretary and show the date the registry must hear by.
---

Read CLAUDE.md first.

```bash
npm run entities -- appoint --entity="Kauri Trading" --person="Jack Morrison" --role=director --date=2026-10-12 --consent=2026-10-10 --actor="<operator>"
```

Read the appointment back and wait for a yes. Show the date the registry must hear by and any warning (no consent, no director ID). Offer draft-consent for a New Zealand director.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
