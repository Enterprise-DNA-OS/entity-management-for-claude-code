---
description: Add a person, outside company or trust, with where they live and their director ID.
---

Read CLAUDE.md first.

```bash
npm run entities -- add-person --name="Aria Thompson" --lives-in=NZ --email=aria@example.com --actor="<operator>"
```

For a director of an Australian company, ask for the director ID (15 digits). For an Australian resident who directs an Australian company, add --au-director=yes.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
