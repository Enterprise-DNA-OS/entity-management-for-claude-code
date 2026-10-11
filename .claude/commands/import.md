---
description: Bring entities, appointments and shareholdings across from Diligent Entities Quick Report exports.
---

Read CLAUDE.md and docs/replace-diligent-entities.md first.

In Diligent Entities, run three Quick Reports (All Entities, Appointments, Shareholders), export each to Excel and save each as CSV in imports/.

```bash
npm run entities -- import diligent --entities=imports/entities.csv --appointments=imports/appointments.csv --shareholders=imports/shareholders.csv --actor="Migration" --dry-run
```

Always run with --dry-run first and show the report, every problem line included. Then run without it on a yes. Use --mapping=<file.json> to rename headings the import does not know ({"Their heading": "Our heading"}), and --dates=mdy for month-first dates. After the import, run attention: imported history is treated as already notified, so what shows is what is due from here.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
