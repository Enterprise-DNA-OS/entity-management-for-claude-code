# Why there is no front end

Diligent Entities is a database with a subscription. The records underneath it are ordinary: entities, the people who run and own them, share movements, filings, meetings, and a calendar of deadlines. What you pay for is the layer on top that lets people who do not write SQL get at those records: screens, filters, ownership charts, dashboards.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, ask "which of our companies have an annual return due this month and who looks after each", and it runs the query and answers. Ask a question the dashboard never had a report for, such as "who ultimately owns Harbour Developments once you look through every company in the chain", and you still get an answer.

## What you gain

- **Better answers.** A Quick Report shows the columns the vendor built. Here you ask your own question, in your own words, against your own records.
- **No seats and no entity bands.** Everyone in the practice who needs to look can look. The bill does not grow with the number of companies you look after.
- **Your data in your Postgres.** Plain tables. Back them up, query them from anything, leave any time.
- **The rules your clients live under.** The New Zealand and Australian deadlines are worked out by the database from the Act and the date, with the section cited.

## What you give up

- **A drawn ownership chart.** The structure command prints the chart as text, and `npm run view` renders pages. A drawn diagram is something Enterprise DNA builds into a customised version.
- **A client portal and e-signatures.** Drafts land in `drafts/` for a person to send and have signed.
- **Filing from inside the tool.** You still lodge with the Companies Office and ASIC, then record it here in one line.
- **Entities in other countries.** The rules here are New Zealand's and Australia's.

## Who this fits

Accounting and law practices that run company secretarial work for client groups, and family or holding groups that look after their own companies. If your team needs a screen to look at all day, keep Diligent Entities. If you need the deadlines met and the answers more than the screens, this is cheaper, faster and yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/diligent-entities
