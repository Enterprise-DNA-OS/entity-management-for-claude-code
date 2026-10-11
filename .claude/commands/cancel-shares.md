---
description: Record a buy-back or cancellation of shares.
---

Read CLAUDE.md first.

```bash
npm run entities -- cancel-shares --entity="Matai Investments" --from="Olivia Hart" --quantity=10 --kind=buy-back --actor="<operator>"
```

Read it back and wait for a yes. A buy-back has its own procedure under each Act: confirm the steps were followed before recording it.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
