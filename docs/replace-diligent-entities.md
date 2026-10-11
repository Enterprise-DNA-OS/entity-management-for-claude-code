# Moving off Diligent Entities

Checked 11 October 2026. Your entities, directors and secretaries, and shareholdings come across from three Diligent Entities Quick Reports in one command. A test run shows everything it would create and every row it would skip before anything is saved.

## 1. Export from Diligent Entities

Diligent Entities' Quick Reports search the records and export the results as an Excel file (see Diligent's help centre, Quick Reports). Run three:

1. **All Entities** (or Companies): name, company number, country, entity type, status, date of incorporation, financial year end, and the annual return filing month for New Zealand companies if your account holds it.
2. **Appointments**: appointed entity, full name, appointed as, date of appointment, date of cessation, country of residence, director identification number, residential address.
3. **Shareholders**: company name, shareholder, share class, number of shares.

Export each to Excel, open it, and save it as CSV under `imports/` in this folder (that folder is ignored by git, so nothing private is committed).

The column headings depend on the columns you pick in each report. The import recognises these:

| File | Field | Headings it reads |
|---|---|---|
| Entities | Name | Name, Company Name, Entity Name, Entity |
| | Number | Company Number, Registration Number, Entity Number, ACN, NZBN |
| | Country | Country, Jurisdiction, Country of Incorporation (New Zealand or Australia; others are skipped) |
| | Type | Entity Type, Company Type, Type |
| | Status | Status, Company Status |
| | Registered | Date of Incorporation, Incorporation Date, Date Incorporated, Registration Date |
| | Balance date | Balance Date, Financial Year End, Year End |
| | NZ filing month | Annual Return Filing Month, Filing Month, Annual Return Month |
| | Group | Group, Client, Entity Group, Client Group |
| Appointments | Entity | Appointed Entity, Company Name, Company, Entity |
| | Person | Full Name, Name, Individual, Officer Name, Officer |
| | Role | Appointed As, Position, Role, Appointment Type (director, alternate director, secretary) |
| | Dates | Date of Appointment, Appointment Date / Date of Cessation, Cessation Date, Resignation Date |
| | Residence | Country of Residence, Residential Country, Residence |
| | Director ID | Director Identification Number, Director ID |
| Shareholders | Entity | Company Name, Company, Entity, Entity Name |
| | Holder | Shareholder, Shareholder Name, Member, Holder, Name |
| | Class and number | Share Class, Class / Number of Shares, Shares, Shares Held |
| | Date | Date Acquired, Date of Issue, Issue Date (else the registration date) |

Dates are read as day first (14/02/2020, 3 Sep 2021 or 2021-09-03). Add `--dates=mdy` for month first.

## 2. Do a test run

```bash
npm run entities -- import diligent --entities=imports/entities.csv --appointments=imports/appointments.csv --shareholders=imports/shareholders.csv --dry-run
```

The report shows how many entities, people, appointments and holdings would be created, and every row it would skip and why: a country outside New Zealand and Australia, an appointment for an entity not in the entities file, a director ID that is not 15 digits, a trust or company named as a director. Nothing is saved.

## 3. Map anything it does not recognise

If a heading is not in the table above, write a mapping file from your heading to one it knows:

```json
{ "Legal Name": "Name", "Officer Role": "Appointed As", "Holding": "Number of Shares" }
```

and add `--mapping=imports/mapping.json`.

## 4. Import

Run the same command without `--dry-run`. It is safe to run again: entities are matched by name, appointments by entity, person, role and date, and a company that already has a share register is left alone.

Then run `/attention`. Appointments and shareholdings from Diligent are treated as already notified, so what shows is what is due from today: annual returns, annual meetings, ASIC reviews, solvency resolutions, and the gaps the import found (people with no country of residence, Australian directors with no director ID).

## What carries across

- Every New Zealand and Australian entity, with its number, status, registration date, balance month and filing month.
- Current and past directors, alternates and secretaries, with their dates, residence and director IDs.
- Each shareholder's holding as an opening balance on the date acquired.

## What does not

- **The share movement history.** The Shareholders report gives holdings, not every issue and transfer. Each holding arrives as one opening entry. If you need the history for the register (the Companies Act 1993 s 87 asks for ten years of it), export Diligent's share transaction records too and ask Claude Code to load them as movements.
- **Documents.** Constitutions, minutes and signed resolutions stay in your document store. Record the meeting dates here with `/record-meeting`.
- **Entities outside New Zealand and Australia.** The rules here are the Companies Act 1993 and the Corporations Act 2001. Other countries need their own rules added with `/customise`.
- **The filing month,** if your Diligent account does not hold it. The import sets it to the registration month and says so for each company: check each one on the Companies Register.

Run Diligent Entities and this side by side for one annual return cycle before you cancel.
