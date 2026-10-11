---
description: Check the records against the rules in docs/compliance.md and list what is late or due, with the rule.
---

1. Read `docs/compliance.md`. Each rule has a name, the section it comes from, what a breach looks like in the data, and the command that finds it.
2. Run `npm run entities -- compliance` (every finding, breached first) and `npm run entities -- annual-cycle`. Use `--json` for detail.
3. Report as a table: rule, count, the worst example (entity and days), the section. Order by severity: breached first, then late (filed after the deadline), then due within 14 days.
4. For anything breached, draft the fix the operator can approve: the filing to lodge and then record, the resolution or consent to draft (draft-solvency, draft-consent, draft-annual-resolution, all to `drafts/`), or the client reminder (draft-reminder).
5. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check together.

Nothing here is legal advice. The doc records the rules the operator has told the system to enforce, with sources, and this command checks the data against them.
