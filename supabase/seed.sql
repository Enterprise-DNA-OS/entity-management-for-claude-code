-- Demo: Tōtara Chartered Accountants, a fictional Hamilton practice that runs company
-- secretarial work for five client groups across New Zealand and Australia. Dates are set
-- relative to the day you first seed, so there is always something late, something due this
-- week and something clean. Safe to run more than once.

insert into cosec.entities (id, name, jurisdiction, kind, company_number, status, incorporated_on, balance_month, filing_month, lodges_financial_reports, registered_office, group_name, responsible) values
  ('e0000001-0000-4000-8000-000000000001', 'Kauri Holdings Limited', 'NZ', 'company', '5512870', 'active', '2015-05-12', 3,
     extract(month from current_date)::int, false, '14 Alexandra Street, Hamilton 3204', 'Kauri family', 'Aroha Ngata'),
  ('e0000002-0000-4000-8000-000000000002', 'Kauri Orchards Limited', 'NZ', 'company', '5730114', 'active', '2016-02-03', 3,
     extract(month from current_date - interval '1 month')::int, false, '14 Alexandra Street, Hamilton 3204', 'Kauri family', 'Aroha Ngata'),
  ('e0000003-0000-4000-8000-000000000003', 'Kauri Trading Pty Ltd', 'AU', 'company', '641 220 187', 'active',
     ((current_date - interval '6 years')::date - 50), 6, null, false, 'Level 3, 50 Pitt Street, Sydney NSW 2000', 'Kauri family', 'Aroha Ngata'),
  ('e0000004-0000-4000-8000-000000000004', 'Rimu Freight Limited', 'NZ', 'company', '6120457', 'active', '2017-08-21', 3,
     extract(month from current_date + interval '4 months')::int, false, '8 Kahikatea Drive, Frankton, Hamilton 3204', 'Rimu Freight', 'Ben Walsh'),
  ('e0000005-0000-4000-8000-000000000005', 'Rimu Freight Australia Pty Ltd', 'AU', 'company', '655 091 342', 'active',
     ((current_date - interval '4 years')::date + 20), 6, null, false, 'Unit 4, 22 Toll Drive, Altona North VIC 3025', 'Rimu Freight', 'Ben Walsh'),
  ('e0000006-0000-4000-8000-000000000006', 'Pohutukawa Dental Limited', 'NZ', 'company', '7004311', 'active', '2019-03-14',
     extract(month from current_date - interval '7 months')::int, extract(month from current_date - interval '5 months')::int, false,
     '201 Victoria Street, Hamilton 3204', 'Pohutukawa Dental', 'Aroha Ngata'),
  ('e0000007-0000-4000-8000-000000000007', 'Harbour Holdings Limited', 'NZ', 'company', '6658902', 'active', '2018-11-05', 3,
     extract(month from current_date + interval '3 months')::int, false, '1 Tasman Quay, Tauranga 3110', 'Liu family', 'Ben Walsh'),
  ('e0000008-0000-4000-8000-000000000008', 'Harbour Property Limited', 'NZ', 'company', '6658977', 'active', '2018-11-09', 3,
     extract(month from current_date - interval '2 months')::int, false, '1 Tasman Quay, Tauranga 3110', 'Liu family', 'Ben Walsh'),
  ('e0000009-0000-4000-8000-000000000009', 'Harbour Developments Pty Ltd', 'AU', 'company', '628 774 019', 'active',
     ((current_date - interval '7 years')::date - 120), 6, null, false, 'Suite 9, 100 Eagle Street, Brisbane QLD 4000', 'Liu family', 'Ben Walsh'),
  ('e0000010-0000-4000-8000-000000000010', 'Matai Investments Pty Ltd', 'AU', 'company', '612 450 776', 'active',
     ((current_date - interval '9 years')::date - 150), 6, null, false, '12 Rundle Mall, Adelaide SA 5000', 'Hart family', 'Ben Walsh'),
  ('e0000011-0000-4000-8000-000000000011', 'Old Totara Ventures Limited', 'NZ', 'company', '4418020', 'removed', '2012-06-01', 3, 6, false,
     null, 'Kauri family', 'Aroha Ngata')
on conflict (id) do nothing;

insert into cosec.parties (id, name, kind, entity_id, lives_in, director_of_au_company, director_id, email) values
  ('a0000001-0000-4000-8000-000000000001', 'Mere Kauri', 'individual', null, 'NZ', true, '036000123456781', 'mere@kauri.example'),
  ('a0000002-0000-4000-8000-000000000002', 'Tom Kauri', 'individual', null, 'NZ', true, null, 'tom@kauri.example'),
  ('a0000003-0000-4000-8000-000000000003', 'Kauri Family Trust', 'trust', null, 'NZ', false, null, null),
  ('a0000004-0000-4000-8000-000000000004', 'Kauri Holdings Limited', 'company', 'e0000001-0000-4000-8000-000000000001', 'NZ', false, null, null),
  ('a0000005-0000-4000-8000-000000000005', 'Sione Taufa', 'individual', null, 'NZ', false, null, 'sione@rimufreight.example'),
  ('a0000006-0000-4000-8000-000000000006', 'Hemi Rawiri', 'individual', null, 'NZ', false, null, 'hemi@rimufreight.example'),
  ('a0000007-0000-4000-8000-000000000007', 'Jack Morrison', 'individual', null, 'AU', true, '036000987654321', 'jack@rimufreight.example'),
  ('a0000008-0000-4000-8000-000000000008', 'Priya Nair', 'individual', null, 'AU', true, '036000555000111', 'priya@rimufreight.example'),
  ('a0000009-0000-4000-8000-000000000009', 'Rimu Freight Limited', 'company', 'e0000004-0000-4000-8000-000000000004', 'NZ', false, null, null),
  ('a0000010-0000-4000-8000-000000000010', 'Lena Park', 'individual', null, 'NZ', false, null, 'lena@pohutukawadental.example'),
  ('a0000011-0000-4000-8000-000000000011', 'Sam Okoro', 'individual', null, 'NZ', false, null, 'sam@pohutukawadental.example'),
  ('a0000012-0000-4000-8000-000000000012', 'Grace Liu', 'individual', null, 'AU', true, '036000222333444', 'grace@harbour.example'),
  ('a0000013-0000-4000-8000-000000000013', 'David Chen', 'individual', null, 'SG', false, null, 'david@harbour.example'),
  ('a0000014-0000-4000-8000-000000000014', 'Liu Family Trust', 'trust', null, 'NZ', false, null, null),
  ('a0000015-0000-4000-8000-000000000015', 'Harbour Holdings Limited', 'company', 'e0000007-0000-4000-8000-000000000007', 'NZ', false, null, null),
  ('a0000016-0000-4000-8000-000000000016', 'Harbour Property Limited', 'company', 'e0000008-0000-4000-8000-000000000008', 'NZ', false, null, null),
  ('a0000017-0000-4000-8000-000000000017', 'Olivia Hart', 'individual', null, 'AU', true, '036000777888999', 'olivia@matai.example'),
  ('a0000018-0000-4000-8000-000000000018', 'Noah Hart', 'individual', null, 'AU', false, null, 'noah@matai.example')
on conflict (id) do nothing;

insert into cosec.officeholders (id, entity_id, party_id, role, appointed_on, consent_on, appointment_notified_on, ceased_on, ceased_notified_on) values
  -- Kauri family: the Sydney company has two New Zealand directors and one has no director ID.
  ('b0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'director', '2015-05-12', '2015-05-10', '2015-05-12', null, null),
  ('b0000002-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000001', 'a0000002-0000-4000-8000-000000000002', 'director', '2015-05-12', '2015-05-10', '2015-05-12', null, null),
  ('b0000003-0000-4000-8000-000000000003', 'e0000002-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 'director', '2016-02-03', '2016-02-01', '2016-02-03', null, null),
  ('b0000004-0000-4000-8000-000000000004', 'e0000003-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000001', 'director', ((current_date - interval '6 years')::date - 50), null, ((current_date - interval '6 years')::date - 50), null, null),
  ('b0000005-0000-4000-8000-000000000005', 'e0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'director', ((current_date - interval '6 years')::date - 50), null, ((current_date - interval '6 years')::date - 50), null, null),
  -- Rimu Freight: a new director nobody told the Companies Office about, an Australian director who resigned and was never notified.
  ('b0000006-0000-4000-8000-000000000006', 'e0000004-0000-4000-8000-000000000004', 'a0000005-0000-4000-8000-000000000005', 'director', '2017-08-21', '2017-08-18', '2017-08-21', null, null),
  ('b0000007-0000-4000-8000-000000000007', 'e0000004-0000-4000-8000-000000000004', 'a0000006-0000-4000-8000-000000000006', 'director', current_date - 34, current_date - 36, null, null, null),
  ('b0000008-0000-4000-8000-000000000008', 'e0000005-0000-4000-8000-000000000005', 'a0000007-0000-4000-8000-000000000007', 'director', ((current_date - interval '4 years')::date + 20), null, ((current_date - interval '4 years')::date + 22), null, null),
  ('b0000009-0000-4000-8000-000000000009', 'e0000005-0000-4000-8000-000000000005', 'a0000008-0000-4000-8000-000000000008', 'director', ((current_date - interval '4 years')::date + 20), null, ((current_date - interval '4 years')::date + 22), current_date - 35, null),
  ('b0000010-0000-4000-8000-000000000010', 'e0000005-0000-4000-8000-000000000005', 'a0000005-0000-4000-8000-000000000005', 'secretary', ((current_date - interval '4 years')::date + 20), null, ((current_date - interval '4 years')::date + 22), null, null),
  -- Pohutukawa Dental: the co-owner was made a director without a signed consent on file.
  ('b0000011-0000-4000-8000-000000000011', 'e0000006-0000-4000-8000-000000000006', 'a0000010-0000-4000-8000-000000000010', 'director', '2019-03-14', '2019-03-12', '2019-03-14', null, null),
  ('b0000012-0000-4000-8000-000000000012', 'e0000006-0000-4000-8000-000000000006', 'a0000011-0000-4000-8000-000000000011', 'director', '2022-07-01', null, '2022-07-08', null, null),
  -- Liu family: an Australian-resident director keeps the New Zealand companies compliant because she directs an Australian company.
  ('b0000013-0000-4000-8000-000000000013', 'e0000007-0000-4000-8000-000000000007', 'a0000012-0000-4000-8000-000000000012', 'director', '2018-11-05', '2018-11-01', '2018-11-05', null, null),
  ('b0000014-0000-4000-8000-000000000014', 'e0000008-0000-4000-8000-000000000008', 'a0000012-0000-4000-8000-000000000012', 'director', '2018-11-09', '2018-11-07', '2018-11-09', null, null),
  ('b0000015-0000-4000-8000-000000000015', 'e0000008-0000-4000-8000-000000000008', 'a0000013-0000-4000-8000-000000000013', 'director', '2020-02-17', '2020-02-10', '2020-02-20', null, null),
  ('b0000016-0000-4000-8000-000000000016', 'e0000009-0000-4000-8000-000000000009', 'a0000012-0000-4000-8000-000000000012', 'director', ((current_date - interval '7 years')::date - 120), null, ((current_date - interval '7 years')::date - 118), null, null),
  -- Hart family: clean.
  ('b0000017-0000-4000-8000-000000000017', 'e0000010-0000-4000-8000-000000000010', 'a0000017-0000-4000-8000-000000000017', 'director', ((current_date - interval '9 years')::date - 150), null, ((current_date - interval '9 years')::date - 148), null, null)
on conflict (id) do nothing;

insert into cosec.share_movements (id, entity_id, kind, share_class, quantity, from_party_id, to_party_id, on_date, consideration_cents, notified_on, reference) values
  ('c0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001', 'issue', 'ORD', 500, null, 'a0000001-0000-4000-8000-000000000001', '2015-05-12', 50000, '2015-05-12', 'On incorporation'),
  ('c0000002-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000001', 'issue', 'ORD', 300, null, 'a0000002-0000-4000-8000-000000000002', '2015-05-12', 30000, '2015-05-12', 'On incorporation'),
  ('c0000003-0000-4000-8000-000000000003', 'e0000001-0000-4000-8000-000000000001', 'issue', 'ORD', 200, null, 'a0000003-0000-4000-8000-000000000003', '2019-04-01', 20000, '2019-04-05', 'Trust subscription'),
  ('c0000004-0000-4000-8000-000000000004', 'e0000002-0000-4000-8000-000000000002', 'issue', 'ORD', 1000, null, 'a0000004-0000-4000-8000-000000000004', '2016-02-03', 100000, '2016-02-03', 'On incorporation'),
  ('c0000005-0000-4000-8000-000000000005', 'e0000003-0000-4000-8000-000000000003', 'issue', 'ORD', 100, null, 'a0000004-0000-4000-8000-000000000004', ((current_date - interval '6 years')::date - 50), 100, ((current_date - interval '6 years')::date - 50), 'On registration'),
  ('c0000006-0000-4000-8000-000000000006', 'e0000004-0000-4000-8000-000000000004', 'issue', 'ORD', 10000, null, 'a0000005-0000-4000-8000-000000000005', '2017-08-21', 1000000, '2017-08-21', 'On incorporation'),
  ('c0000007-0000-4000-8000-000000000007', 'e0000004-0000-4000-8000-000000000004', 'issue', 'ORD', 1500, null, 'a0000006-0000-4000-8000-000000000006', current_date - 4, 15000000, null, 'Hemi Rawiri buys in'),
  ('c0000008-0000-4000-8000-000000000008', 'e0000005-0000-4000-8000-000000000005', 'issue', 'ORD', 1, null, 'a0000009-0000-4000-8000-000000000009', ((current_date - interval '4 years')::date + 20), 100, ((current_date - interval '4 years')::date + 22), 'On registration'),
  ('c0000009-0000-4000-8000-000000000009', 'e0000006-0000-4000-8000-000000000006', 'issue', 'ORD', 60, null, 'a0000010-0000-4000-8000-000000000010', '2019-03-14', 6000, '2019-03-14', 'On incorporation'),
  ('c0000010-0000-4000-8000-000000000010', 'e0000006-0000-4000-8000-000000000006', 'issue', 'ORD', 40, null, 'a0000011-0000-4000-8000-000000000011', '2022-07-01', 32000000, '2022-07-08', 'Sam Okoro buys in'),
  ('c0000011-0000-4000-8000-000000000011', 'e0000007-0000-4000-8000-000000000007', 'issue', 'ORD', 500, null, 'a0000012-0000-4000-8000-000000000012', '2018-11-05', 500, '2018-11-05', 'On incorporation'),
  ('c0000012-0000-4000-8000-000000000012', 'e0000007-0000-4000-8000-000000000007', 'issue', 'ORD', 500, null, 'a0000014-0000-4000-8000-000000000014', '2018-11-05', 500, '2018-11-05', 'On incorporation'),
  ('c0000013-0000-4000-8000-000000000013', 'e0000008-0000-4000-8000-000000000008', 'issue', 'ORD', 700, null, 'a0000015-0000-4000-8000-000000000015', '2018-11-09', 700, '2018-11-09', 'On incorporation'),
  ('c0000014-0000-4000-8000-000000000014', 'e0000008-0000-4000-8000-000000000008', 'issue', 'ORD', 300, null, 'a0000013-0000-4000-8000-000000000013', '2020-02-17', 90000000, '2020-02-20', 'David Chen buys in'),
  ('c0000015-0000-4000-8000-000000000015', 'e0000009-0000-4000-8000-000000000009', 'issue', 'ORD', 10, null, 'a0000016-0000-4000-8000-000000000016', ((current_date - interval '7 years')::date - 120), 10, ((current_date - interval '7 years')::date - 118), 'On registration'),
  ('c0000016-0000-4000-8000-000000000016', 'e0000010-0000-4000-8000-000000000010', 'issue', 'ORD', 100, null, 'a0000017-0000-4000-8000-000000000017', ((current_date - interval '9 years')::date - 150), 100, ((current_date - interval '9 years')::date - 148), 'On registration'),
  ('c0000017-0000-4000-8000-000000000017', 'e0000010-0000-4000-8000-000000000010', 'transfer', 'ORD', 25, 'a0000017-0000-4000-8000-000000000017', 'a0000018-0000-4000-8000-000000000018', current_date - 16, 2500000, null, 'Olivia to Noah, family transfer')
on conflict (id) do nothing;

insert into cosec.filings (id, entity_id, kind, period, filed_on, reference, fee_cents) values
  -- Last year's annual returns, all on time.
  ('f0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001', 'annual-return', (extract(year from current_date)::int - 1)::text, make_date(extract(year from current_date)::int - 1, extract(month from current_date)::int, 8), 'AR-KH-LY', null),
  ('f0000002-0000-4000-8000-000000000002', 'e0000002-0000-4000-8000-000000000002', 'annual-return', (extract(year from current_date)::int - 1)::text, make_date(extract(year from current_date - interval '1 month')::int - 1, extract(month from current_date - interval '1 month')::int, 12), 'AR-KO-LY', null),
  -- Harbour Developments: this year's review done properly.
  ('f0000005-0000-4000-8000-000000000005', 'e0000009-0000-4000-8000-000000000009', 'annual-review-fee', extract(year from current_date - 120)::int::text, current_date - 100, 'ASIC-HD', null),
  ('f0000006-0000-4000-8000-000000000006', 'e0000009-0000-4000-8000-000000000009', 'statement-checked', extract(year from current_date - 120)::int::text, current_date - 112, null, null),
  -- Matai: this year's review done.
  ('f0000007-0000-4000-8000-000000000007', 'e0000010-0000-4000-8000-000000000010', 'annual-review-fee', extract(year from current_date - 150)::int::text, current_date - 131, 'ASIC-MI', null),
  ('f0000008-0000-4000-8000-000000000008', 'e0000010-0000-4000-8000-000000000010', 'statement-checked', extract(year from current_date - 150)::int::text, current_date - 140, null, null),
  -- Kauri Trading: statement checked, fee not yet paid.
  ('f0000009-0000-4000-8000-000000000009', 'e0000003-0000-4000-8000-000000000003', 'statement-checked', extract(year from current_date - 50)::int::text, current_date - 41, null, null)
on conflict (id) do nothing;

-- Every other New Zealand company whose filing month has passed this year filed on the 6th of it.
-- Kauri Orchards did not: its month has just gone by.
insert into cosec.filings (id, entity_id, kind, period, filed_on, reference, fee_cents)
select ('f10000' || right(e.id::text, 2) || '-0000-4000-8000-0000000001' || right(e.id::text, 2))::uuid, e.id, 'annual-return', extract(year from current_date)::int::text,
       make_date(extract(year from current_date)::int, e.filing_month, 6), 'AR-' || e.company_number, null
  from cosec.entities e
 where e.jurisdiction = 'NZ' and e.status = 'active' and e.id <> 'e0000002-0000-4000-8000-000000000002'
   and e.filing_month < extract(month from current_date)
on conflict (id) do nothing;

insert into cosec.meetings (id, entity_id, kind, held_on, title, outcome, minutes_on) values
  ('d0000001-0000-4000-8000-000000000001', 'e0000009-0000-4000-8000-000000000009', 'solvency-resolution', current_date - 105, 'Directors'' solvency resolution', 'positive', current_date - 105),
  ('d0000002-0000-4000-8000-000000000002', 'e0000010-0000-4000-8000-000000000010', 'solvency-resolution', current_date - 140, 'Directors'' solvency resolution', 'positive', current_date - 139),
  ('d0000003-0000-4000-8000-000000000003', 'e0000005-0000-4000-8000-000000000005', 'board', current_date - 40, 'Board meeting: Melbourne depot lease', null, null),
  ('d0000004-0000-4000-8000-000000000004', 'e0000005-0000-4000-8000-000000000005', 'board', current_date - 20, 'Board meeting: Priya Nair''s resignation', null, null),
  ('d0000005-0000-4000-8000-000000000005', 'e0000001-0000-4000-8000-000000000001', 'annual-resolution', current_date - 120, 'Annual written resolution in lieu of meeting', null, current_date - 120),
  ('d0000006-0000-4000-8000-000000000006', 'e0000002-0000-4000-8000-000000000002', 'annual-resolution', current_date - 118, 'Annual written resolution in lieu of meeting', null, current_date - 118),
  ('d0000007-0000-4000-8000-000000000007', 'e0000004-0000-4000-8000-000000000004', 'annual-meeting', current_date - 90, 'Annual meeting of shareholders', null, current_date - 88),
  ('d0000008-0000-4000-8000-000000000008', 'e0000006-0000-4000-8000-000000000006', 'annual-meeting', current_date - 380, 'Annual meeting of shareholders', null, current_date - 379),
  ('d0000009-0000-4000-8000-000000000009', 'e0000007-0000-4000-8000-000000000007', 'annual-resolution', current_date - 150, 'Annual written resolution in lieu of meeting', null, current_date - 150),
  ('d0000010-0000-4000-8000-000000000010', 'e0000008-0000-4000-8000-000000000008', 'annual-resolution', current_date - 150, 'Annual written resolution in lieu of meeting', null, current_date - 150)
on conflict (id) do nothing;

insert into cosec.activity_log (actor, action, detail)
select 'Seed', 'seed', 'Tōtara Chartered Accountants demo loaded'
 where not exists (select 1 from cosec.activity_log where action = 'seed');
