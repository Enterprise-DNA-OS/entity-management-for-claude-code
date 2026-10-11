# Entity Management for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Add a company, trust or partnership with its country, number, balance and filing months, group and staff member | `/add-entity` |
| Add a holiday the working-day count skips (next year's dates, or a new one) | `/add-holiday` |
| Add a person, outside company or trust, with where they live and their director ID | `/add-person` |
| Show the yearly cycle for every company: NZ annual returns and annual meetings, AU review fees, statement checks and solvency resolutions | `/annual-cycle` |
| Appoint a director or secretary and show the date the registry must hear by | `/appoint` |
| List what needs a person: late notices, missed filings, missing director IDs and consents, minutes not recorded, and what is due soon | `/attention` |
| List every deadline in the next N days (default 60), nearest first | `/calendar` |
| Record a buy-back or cancellation of shares | `/cancel-shares` |
| Record a director or secretary leaving and show the date the registry must hear by | `/cease` |
| Check the records against the rules in docs/compliance.md and list what is late or due, with the rule | `/compliance` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it | `/customise` |
| List every director of an Australian company and whether a director ID is on file | `/director-ids` |
| Draft a New Zealand shareholders' written resolution in lieu of the annual meeting (s 122) | `/draft-annual-resolution` |
| Draft a New Zealand director's consent and certificate (s 152) for signing | `/draft-consent` |
| Draft the client email for one group: what is due and what we need from them | `/draft-reminder` |
| Draft an Australian directors' solvency resolution (s 347A) for signing | `/draft-solvency` |
| List every entity: country, number, client group, who looks after it, directors and open items | `/entities` |
| Show one entity on one page: details, officers, share register, the yearly cycle and what is open | `/entity` |
| Write every record to one JSON file the business owns | `/export` |
| Record a filing: annual return, ASIC review fee paid, annual statement checked, address or name change | `/file` |
| List what was filed with the Companies Office or ASIC, newest first | `/filings` |
| Rank client groups by what is late and what is due | `/groups` |
| List every command this system has, in plain words | `/help` |
| Show the last 50 changes and who made them | `/history` |
| List the holidays the working-day count skips | `/holidays` |
| Bring entities, appointments and shareholdings across from Diligent Entities Quick Report exports | `/import` |
| Issue shares to a holder and show the notice deadline | `/issue-shares` |
| Record that a change was filed with the Companies Office or ASIC | `/mark-notified` |
| List meetings and resolutions, with when the minutes were recorded | `/meetings` |
| List share issues, transfers, buy-backs and cancellations, newest first | `/movements` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view` | `/new-view` |
| List every change the Companies Office or ASIC has not been told about, with its legal deadline | `/notices` |
| List the current directors and secretaries of every entity | `/officers` |
| List every person, company and trust on file with their offices and holdings | `/people` |
| Show every company a person or trust is a director, secretary or shareholder of, including through other companies | `/person` |
| Record a board or shareholders' meeting, annual meeting, written resolution or solvency resolution | `/record-meeting` |
| Record the day a meeting's minutes went into the minute book | `/record-minutes` |
| Show the share register of one entity: each holder, class, shares and percentage | `/register` |
| Draw a client group's ownership chart as text: who holds what, down the chain | `/structure` |
| Transfer shares between holders and show the notice deadline where one applies | `/transfer-shares` |
| Change an entity: name, number, status, months, registered office, group, staff member, or that it lodges financial reports | `/update-entity` |
| Change a person's residence, director ID, address or email | `/update-person` |
| Write the Monday review: what needs a person, unnotified changes, the next 30 days, client groups and staff | `/weekly-review` |
| Look through every company in the chain to the people and trusts who ultimately own an entity | `/who-controls` |
| Show each staff member's late and due items for the next N days (default 30) | `/workload` |

If an ask fits nothing here, run the CLI directly (`npm run entities -- help`) and then propose a new command for it.

## How company secretarial work runs here

- Holdings come from movements: issue, transfer, buy-back, cancellation. Never type a holding in; record the movement that made it.
- Deadlines come from the database. Never work one out by hand: run `notices`, `annual-cycle` or `calendar`.
- Record a filing only once it is lodged or paid, with its reference. Mark a notice filed with `mark-notified` the same way.
- Appointing or removing an officeholder, issuing or transferring shares, and recording a filing change the statutory record: read it back and wait for a yes.
- Anything about the law cites `docs/compliance.md`. A negative solvency resolution, a company with no director, or a question about whether a step was lawful: say so plainly and suggest advice. Nothing here is legal advice.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Diligent Entities.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/diligent-entities
