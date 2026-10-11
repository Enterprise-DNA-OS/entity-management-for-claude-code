<h1 align="center">Entity Management for Claude Code</h1>

<p align="center">
  <strong>The open-source entity management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Diligent Entities data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=diligent-entities">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/diligent-entities?utm_source=github&utm_medium=readme&utm_campaign=diligent-entities">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-diligent-entities">Instead of Diligent Entities</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Entity Management for Claude Code does the job you pay Diligent Entities for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions Diligent Entities' reports do not.

Diligent publishes no price for Diligent Entities: its [product page](https://www.diligent.com/products/entities) and [pricing page](https://www.diligent.com/pricing) ask you to request a quote for "a package tailored to your organization's size" (checked 11 October 2026). Whatever the quote, this costs nothing to run.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=diligent-entities).

It keeps the statutory records for New Zealand and Australian companies: each entity, its directors and secretaries, its share register as a list of issues and transfers, its filings and its meetings. From those it works out every deadline the law sets: the New Zealand annual return and annual meeting, director and share issue notices in working days, the ASIC annual review fee, the statement check and the solvency resolution, and the 28-day notices. It flags a company with no resident director, an Australian director with no director ID, a New Zealand director with no signed consent, and minutes not written up within a month. Built for accounting and law practices that run company secretarial work for client groups, and for family and holding groups that look after their own companies.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no entity bands, no modules. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what a drawn chart and a client portal give that this does not.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/entity-management-for-claude-code.git
cd entity-management-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. The demo is Tōtara Chartered Accountants, a fictional Hamilton practice looking after eleven companies in five client groups: a new director at Rimu Freight nobody told the Companies Office about, an Australian director who resigned and was never notified, a Sydney company with no Australian-resident director, an annual return that has slipped past its month, and an ASIC review fee due this fortnight.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

45 commands. Every one drives `npm run entities -- <command>`, which also takes `--json`.

| Command | What it does |
|---|---|
| `/add-entity` | Add a company, trust or partnership with its country, number, balance and filing months, group and staff member. |
| `/add-holiday` | Add a holiday the working-day count skips (next year's dates, or a new one). |
| `/add-person` | Add a person, outside company or trust, with where they live and their director ID. |
| `/annual-cycle` | Show the yearly cycle for every company: NZ annual returns and annual meetings, AU review fees, statement checks and solvency resolutions. |
| `/appoint` | Appoint a director or secretary and show the date the registry must hear by. |
| `/attention` | List what needs a person: late notices, missed filings, missing director IDs and consents, minutes not recorded, and what is due soon. |
| `/calendar` | List every deadline in the next N days (default 60), nearest first. |
| `/cancel-shares` | Record a buy-back or cancellation of shares. |
| `/cease` | Record a director or secretary leaving and show the date the registry must hear by. |
| `/compliance` | Check the records against the rules in docs/compliance.md and list what is late or due, with the rule. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/director-ids` | List every director of an Australian company and whether a director ID is on file. |
| `/draft-annual-resolution` | Draft a New Zealand shareholders' written resolution in lieu of the annual meeting (s 122). |
| `/draft-consent` | Draft a New Zealand director's consent and certificate (s 152) for signing. |
| `/draft-reminder` | Draft the client email for one group: what is due and what we need from them. |
| `/draft-solvency` | Draft an Australian directors' solvency resolution (s 347A) for signing. |
| `/entities` | List every entity: country, number, client group, who looks after it, directors and open items. |
| `/entity` | Show one entity on one page: details, officers, share register, the yearly cycle and what is open. |
| `/export` | Write every record to one JSON file the business owns. |
| `/file` | Record a filing: annual return, ASIC review fee paid, annual statement checked, address or name change. |
| `/filings` | List what was filed with the Companies Office or ASIC, newest first. |
| `/groups` | Rank client groups by what is late and what is due. |
| `/help` | List every command this system has, in plain words. |
| `/history` | Show the last 50 changes and who made them. |
| `/holidays` | List the holidays the working-day count skips. |
| `/import` | Bring entities, appointments and shareholdings across from Diligent Entities Quick Report exports. |
| `/issue-shares` | Issue shares to a holder and show the notice deadline. |
| `/mark-notified` | Record that a change was filed with the Companies Office or ASIC. |
| `/meetings` | List meetings and resolutions, with when the minutes were recorded. |
| `/movements` | List share issues, transfers, buy-backs and cancellations, newest first. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/notices` | List every change the Companies Office or ASIC has not been told about, with its legal deadline. |
| `/officers` | List the current directors and secretaries of every entity. |
| `/people` | List every person, company and trust on file with their offices and holdings. |
| `/person` | Show every company a person or trust is a director, secretary or shareholder of, including through other companies. |
| `/record-meeting` | Record a board or shareholders' meeting, annual meeting, written resolution or solvency resolution. |
| `/record-minutes` | Record the day a meeting's minutes went into the minute book. |
| `/register` | Show the share register of one entity: each holder, class, shares and percentage. |
| `/structure` | Draw a client group's ownership chart as text: who holds what, down the chain. |
| `/transfer-shares` | Transfer shares between holders and show the notice deadline where one applies. |
| `/update-entity` | Change an entity: name, number, status, months, registered office, group, staff member, or that it lodges financial reports. |
| `/update-person` | Change a person's residence, director ID, address or email. |
| `/weekly-review` | Write the Monday review: what needs a person, unnotified changes, the next 30 days, client groups and staff. |
| `/who-controls` | Look through every company in the chain to the people and trusts who ultimately own an entity. |
| `/workload` | Show each staff member's late and due items for the next N days (default 30). |

### What it looks like

```
$ npm run entities -- who-controls "Harbour Developments"
  ultimate holder   effective %  via                                                
  ----------------  -----------  ---------------------------------------------------
  Grace Liu                  35  Harbour Property Limited > Harbour Holdings Limited
  Liu Family Trust           35  Harbour Property Limited > Harbour Holdings Limited
  David Chen                 30  Harbour Property Limited
```

```
$ npm run entities -- notices
  change          entity                          detail                                happened on  due on      days left  rule                    id      
  --------------  ------------------------------  ------------------------------------  -----------  ----------  ---------  ----------------------  --------
  cessation       Rimu Freight Australia Pty Ltd  Priya Nair ceased as director         2026-09-06   2026-10-04         -7  AU-OFFICEHOLDER-NOTICE  b0000009
  appointment     Rimu Freight Limited            Hemi Rawiri appointed director        2026-09-07   2026-10-05         -6  NZ-DIRECTOR-NOTICE      b0000007
  share issue     Rimu Freight Limited            1500 ORD to Hemi Rawiri               2026-10-07   2026-10-21         10  NZ-SHARE-ISSUE-NOTICE   c0000007
  share transfer  Matai Investments Pty Ltd       25 ORD to Noah Hart from Olivia Hart  2026-09-25   2026-10-23         12  AU-SHARE-NOTICE         c0000017
```

## Ten questions Diligent Entities' reports do not answer for you

Each is one command here, on your own records.

| Question | Command |
|---|---|
| Which changes has the Companies Office or ASIC not heard about, and what is the last day for each, counted in working days? | `notices` |
| Which New Zealand annual returns are due this month, and which month has already gone by? | `annual-cycle` |
| Which Australian companies still need a solvency resolution before the two months run out? | `annual-cycle` |
| Which companies have no director who meets the residence test in their own country? | `compliance` |
| Which directors of Australian companies have no director ID on file? | `director-ids` |
| Every company Grace Liu is a director or shareholder of, including through other companies? | `person` |
| Who ultimately owns Harbour Developments once you look through every company in the chain? | `who-controls` |
| Which board meetings have no minutes written up within a month? | `compliance` |
| Which client group has the most late items, and who looks after it? | `groups` |
| What does each person in the practice have due in the next 30 days? | `workload` |

## Your first hour: ten things to ask for

1. "Put our practice name, logo and colours on the registers" (edits `brand.json`).
2. "What needs doing this week?"
3. "Hemi Rawiri was appointed a director of Rimu Freight on 7 September. Draft his consent."
4. "We filed the Kauri Orchards annual return today, reference AR-5730114."
5. "Draft the reminder email to the Kauri family about what is due."
6. "Kauri Trading needs an Australian director. Appoint Jack Morrison from Monday."
7. "Show me the share register for Matai Investments and the transfer to Noah."
8. "Add the shareholders' agreement review date as a field on each company" (`/customise`).
9. "Give me a page for each staff member: what is due in the next 60 days" (`/new-view`).
10. "Test our Diligent Entities exports without saving anything."

## Instead of Diligent Entities

Run three Quick Reports in Diligent Entities (All Entities, Appointments, Shareholders), save each as CSV, do a test run, then import:

```bash
npm run entities -- import diligent --entities=imports/entities.csv --appointments=imports/appointments.csv --shareholders=imports/shareholders.csv --dry-run
```

The test run lists every entity, person, appointment and holding it would create, and every row it would skip and why. The full guide, with the headings it reads, the mapping file and what does not carry over: [docs/replace-diligent-entities.md](docs/replace-diligent-entities.md).

## Documents and views

- `npm run docs` renders, for every active company, a register of directors and secretaries, a share register with ten years of movements, and a company secretarial summary (the yearly cycle, open items and recent filings), all from `brand.json`.
- Drafts for signing land in `drafts/`: a New Zealand director's consent (s 152), an Australian solvency resolution (s 347A), a written resolution in lieu of the annual meeting (s 122), and the client reminder email.
- `npm run view` renders two read-only pages: the week (what needs a person, unnotified changes, client groups) and the year (the annual cycle, director IDs).
- `/compliance` checks the records against the rules in [docs/compliance.md](docs/compliance.md), each with its section.

## How the deadlines work

- New Zealand notices count working days: weekdays that are not national holidays, and not 25 December to 2 January. Director changes 20 working days (s 159), share issues 10 (s 43).
- Australian notices count 28 calendar days (ss 178A, 205B, 254X). The annual review date is the anniversary of registration; the fee and the solvency resolution are due 2 months after it, the statement check 28 days after it.
- Holdings are the sum of every issue, transfer, buy-back and cancellation. The database refuses a transfer of more shares than the holder has on that day.
- Ownership look-through multiplies each holding down the chain of companies you hold records for, to the people and trusts at the top.

This system records and reminds. It lodges nothing with the Companies Office or ASIC, and it is not legal advice.

## Architecture

```
entity-management-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/entities.mjs      the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema, views and the deadline rules
  supabase/seed.sql         demo data
  docs/                     the thesis, the rules and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Entity Management for Claude Code for your business, migrates your Diligent Entities data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=diligent-entities)
- Read more: [enterprisedna.co/omni/instead-of/diligent-entities](https://enterprisedna.co/omni/instead-of/diligent-entities?utm_source=github&utm_medium=readme&utm_campaign=diligent-entities)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
