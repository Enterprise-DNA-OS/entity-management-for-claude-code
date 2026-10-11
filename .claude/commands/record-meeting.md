---
description: Record a board or shareholders' meeting, annual meeting, written resolution or solvency resolution.
---

Read CLAUDE.md first.

```bash
npm run entities -- record-meeting --entity="Kauri Trading" --kind=solvency-resolution --outcome=positive --date=2026-10-12 --actor="<operator>"
```

Kinds: board, shareholders, annual-meeting, annual-resolution, solvency-resolution, written-resolution. A negative solvency resolution is lodged with ASIC within 7 days: say so plainly and stop.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
