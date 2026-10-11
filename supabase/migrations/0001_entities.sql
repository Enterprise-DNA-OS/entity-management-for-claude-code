-- Entity management: the companies a business or practice looks after (New Zealand and
-- Australian), the people and companies that hold office or shares in them, the share
-- register as a list of movements, filings with the Companies Office and ASIC, meetings and
-- resolutions, and the deadlines the law sets for each. Runs on Postgres 14+ and PGlite.
-- Holdings are computed from movements, never typed in. Deadlines are computed, never typed in.

create schema if not exists cosec;

create or replace function cosec.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Each company, trust or other entity on the books. group_name is the client or family group
-- it belongs to; responsible is the staff member who looks after it.
create table cosec.entities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  jurisdiction text not null check (jurisdiction in ('NZ', 'AU')),
  kind text not null default 'company' check (kind in ('company', 'public-company', 'trust', 'partnership', 'other')),
  company_number text,
  status text not null default 'active' check (status in ('active', 'removed', 'in-liquidation')),
  incorporated_on date,
  balance_month integer not null default 3 check (balance_month between 1 and 12),
  filing_month integer check (filing_month between 1 and 12),          -- NZ: the month the annual return is due
  lodges_financial_reports boolean not null default false,               -- AU: a report lodged in the last 12 months removes the solvency resolution
  registered_office text,
  group_name text,
  responsible text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jurisdiction <> 'NZ' or kind not in ('company', 'public-company') or filing_month is not null)
);
create unique index entities_name_ci on cosec.entities (lower(name));

-- People, and outside companies or trusts that hold shares. Only individuals hold office.
create table cosec.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  kind text not null default 'individual' check (kind in ('individual', 'company', 'trust')),
  entity_id uuid references cosec.entities(id),                        -- set when the holder is one of our own entities
  lives_in text check (lives_in is null or lives_in ~ '^[A-Z]{2}$'),   -- country of residence, ISO code
  director_of_au_company boolean not null default false,                -- NZ s 10(d): an Australian resident must also direct an Australian company
  director_id text check (director_id is null or director_id ~ '^\d{15}$'),
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'individual' or entity_id is null)
);
create unique index parties_name_ci on cosec.parties (lower(name));
create unique index parties_entity on cosec.parties (entity_id) where entity_id is not null;

-- Directors, secretaries and alternates. Ceasing closes the row; the history stays.
create table cosec.officeholders (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references cosec.entities(id),
  party_id uuid not null references cosec.parties(id),
  role text not null check (role in ('director', 'secretary', 'alternate-director')),
  appointed_on date not null,
  consent_on date,                         -- NZ s 152: written consent before appointment
  appointment_notified_on date,
  ceased_on date check (ceased_on is null or ceased_on >= appointed_on),
  ceased_notified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ceased_notified_on is null or ceased_on is not null)
);
create unique index officeholders_open on cosec.officeholders (entity_id, party_id, role) where ceased_on is null;

-- The share register as movements: issues, transfers, buy-backs and cancellations.
create table cosec.share_movements (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references cosec.entities(id),
  kind text not null check (kind in ('issue', 'transfer', 'buy-back', 'cancellation')),
  share_class text not null default 'ORD',
  quantity bigint not null check (quantity > 0),
  from_party_id uuid references cosec.parties(id),
  to_party_id uuid references cosec.parties(id),
  on_date date not null,
  consideration_cents bigint check (consideration_cents is null or consideration_cents >= 0),
  notified_on date,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (case kind when 'issue' then to_party_id is not null and from_party_id is null
                   when 'transfer' then to_party_id is not null and from_party_id is not null and to_party_id <> from_party_id
                   else from_party_id is not null and to_party_id is null end)
);

-- What was lodged with the Companies Office or ASIC, or paid to them.
create table cosec.filings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references cosec.entities(id),
  kind text not null check (kind in ('annual-return', 'annual-review-fee', 'statement-checked', 'address-change', 'name-change', 'constitution', 'other')),
  period text,                             -- the year a recurring filing belongs to, e.g. 2026
  filed_on date not null,
  reference text,
  fee_cents bigint check (fee_cents is null or fee_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index filings_period on cosec.filings (entity_id, kind, period) where period is not null;

-- Meetings and resolutions. minutes_on is the day the minutes were recorded in the book.
create table cosec.meetings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references cosec.entities(id),
  kind text not null check (kind in ('board', 'shareholders', 'annual-meeting', 'annual-resolution', 'solvency-resolution', 'written-resolution')),
  held_on date not null,
  title text not null,
  outcome text,                            -- for a solvency resolution: positive or negative
  minutes_on date check (minutes_on is null or minutes_on >= held_on),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'solvency-resolution' or outcome in ('positive', 'negative'))
);

-- Days that are not working days for the Companies Act count (national holidays, observed).
create table cosec.holidays (
  on_date date not null,
  jurisdiction text not null check (jurisdiction in ('NZ', 'AU')),
  name text not null,
  primary key (on_date, jurisdiction)
);

insert into cosec.holidays (on_date, jurisdiction, name) values
  ('2025-01-01', 'NZ', 'New Year''s Day'), ('2025-01-02', 'NZ', 'Day after New Year''s Day'), ('2025-02-06', 'NZ', 'Waitangi Day'),
  ('2025-04-18', 'NZ', 'Good Friday'), ('2025-04-21', 'NZ', 'Easter Monday'), ('2025-04-25', 'NZ', 'Anzac Day'),
  ('2025-06-02', 'NZ', 'King''s Birthday'), ('2025-06-20', 'NZ', 'Matariki'), ('2025-10-27', 'NZ', 'Labour Day'),
  ('2025-12-25', 'NZ', 'Christmas Day'), ('2025-12-26', 'NZ', 'Boxing Day'),
  ('2026-01-01', 'NZ', 'New Year''s Day'), ('2026-01-02', 'NZ', 'Day after New Year''s Day'), ('2026-02-06', 'NZ', 'Waitangi Day'),
  ('2026-04-03', 'NZ', 'Good Friday'), ('2026-04-06', 'NZ', 'Easter Monday'), ('2026-04-27', 'NZ', 'Anzac Day (observed)'),
  ('2026-06-01', 'NZ', 'King''s Birthday'), ('2026-07-10', 'NZ', 'Matariki'), ('2026-10-26', 'NZ', 'Labour Day'),
  ('2026-12-25', 'NZ', 'Christmas Day'), ('2026-12-28', 'NZ', 'Boxing Day (observed)'),
  ('2027-01-01', 'NZ', 'New Year''s Day'), ('2027-01-04', 'NZ', 'Day after New Year''s Day (observed)'), ('2027-02-08', 'NZ', 'Waitangi Day (observed)'),
  ('2027-03-26', 'NZ', 'Good Friday'), ('2027-03-29', 'NZ', 'Easter Monday'), ('2027-04-26', 'NZ', 'Anzac Day (observed)'),
  ('2027-06-07', 'NZ', 'King''s Birthday'), ('2027-06-25', 'NZ', 'Matariki'), ('2027-10-25', 'NZ', 'Labour Day'),
  ('2027-12-27', 'NZ', 'Christmas Day (observed)'), ('2027-12-28', 'NZ', 'Boxing Day (observed)');

create table cosec.activity_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor text not null,
  action text not null,
  detail text
);

create trigger entities_touch before update on cosec.entities for each row execute function cosec.touch();
create trigger parties_touch before update on cosec.parties for each row execute function cosec.touch();
create trigger officeholders_touch before update on cosec.officeholders for each row execute function cosec.touch();
create trigger share_movements_touch before update on cosec.share_movements for each row execute function cosec.touch();
create trigger filings_touch before update on cosec.filings for each row execute function cosec.touch();
create trigger meetings_touch before update on cosec.meetings for each row execute function cosec.touch();

-- Only individuals hold office.
create or replace function cosec.officeholder_guard() returns trigger language plpgsql as $$
begin
  if (select kind from cosec.parties where id = new.party_id) <> 'individual' then
    raise exception 'Only an individual can be a director or secretary';
  end if;
  return new;
end $$;
create trigger officeholder_guard before insert or update on cosec.officeholders for each row execute function cosec.officeholder_guard();

-- A transfer, buy-back or cancellation cannot take more shares than the holder has on that day.
create or replace function cosec.movement_guard() returns trigger language plpgsql as $$
declare held bigint;
begin
  if new.from_party_id is null then return new; end if;
  select coalesce(sum(case when to_party_id = new.from_party_id then quantity else -quantity end), 0) into held
    from cosec.share_movements
   where entity_id = new.entity_id and share_class = new.share_class and on_date <= new.on_date and id <> new.id
     and (to_party_id = new.from_party_id or from_party_id = new.from_party_id);
  if held < new.quantity then
    raise exception 'The holder has % % shares on %, not %', held, new.share_class, new.on_date, new.quantity;
  end if;
  return new;
end $$;
create trigger movement_guard before insert or update on cosec.share_movements for each row execute function cosec.movement_guard();

-- n working days after d. NZ: weekdays that are not national holidays, and not 25 December
-- to 2 January (the shortest summer closure in New Zealand statutes, so a deadline is never late).
create or replace function cosec.add_working_days(d date, n integer, jur text) returns date language plpgsql stable as $$
declare cur date := d; counted integer := 0;
begin
  while counted < n loop
    cur := cur + 1;
    if extract(isodow from cur) < 6
       and not exists (select 1 from cosec.holidays h where h.on_date = cur and h.jurisdiction = jur)
       and not (jur = 'NZ' and ((extract(month from cur) = 12 and extract(day from cur) >= 25) or (extract(month from cur) = 1 and extract(day from cur) <= 2))) then
      counted := counted + 1;
    end if;
  end loop;
  return cur;
end $$;

-- ---------------------------------------------------------------- views

create view cosec.current_officeholders as
select o.id, o.entity_id, e.name as entity, e.jurisdiction, p.id as party_id, p.name as person, o.role, o.appointed_on, o.consent_on,
       p.lives_in, p.director_of_au_company, p.director_id
  from cosec.officeholders o join cosec.entities e on e.id = o.entity_id join cosec.parties p on p.id = o.party_id
 where o.ceased_on is null;

-- Each holder's shares by class, from the movements.
create view cosec.holdings as
with legs as (
  select entity_id, share_class, to_party_id as party_id, quantity as qty from cosec.share_movements where to_party_id is not null
  union all
  select entity_id, share_class, from_party_id, -quantity from cosec.share_movements where from_party_id is not null
), totals as (
  select entity_id, share_class, party_id, sum(qty)::bigint as shares from legs group by entity_id, share_class, party_id
)
select t.entity_id, e.name as entity, t.share_class, t.party_id, p.name as holder, p.kind as holder_kind, p.entity_id as holder_entity_id, t.shares,
       round(100.0 * t.shares / nullif(sum(t.shares) over (partition by t.entity_id, t.share_class), 0), 2) as pct_of_class
  from totals t join cosec.entities e on e.id = t.entity_id join cosec.parties p on p.id = t.party_id
 where t.shares <> 0;

-- Every change the registry has to hear about, its legal deadline, and whether it was told.
create view cosec.notices as
select 'appointment' as change, o.id as source_id, e.id as entity_id, e.name as entity, e.jurisdiction,
       p.name || ' appointed ' || o.role as detail, o.appointed_on as happened_on,
       case e.jurisdiction when 'NZ' then cosec.add_working_days(o.appointed_on, 20, 'NZ') else o.appointed_on + 28 end as due_on,
       o.appointment_notified_on as notified_on,
       case e.jurisdiction when 'NZ' then 'NZ-DIRECTOR-NOTICE' else 'AU-OFFICEHOLDER-NOTICE' end as rule
  from cosec.officeholders o join cosec.entities e on e.id = o.entity_id join cosec.parties p on p.id = o.party_id
 where e.kind in ('company', 'public-company') and (e.jurisdiction = 'AU' or o.role <> 'secretary')
union all
select 'cessation', o.id, e.id, e.name, e.jurisdiction, p.name || ' ceased as ' || o.role, o.ceased_on,
       case e.jurisdiction when 'NZ' then cosec.add_working_days(o.ceased_on, 20, 'NZ') else o.ceased_on + 28 end,
       o.ceased_notified_on,
       case e.jurisdiction when 'NZ' then 'NZ-DIRECTOR-NOTICE' else 'AU-OFFICEHOLDER-NOTICE' end
  from cosec.officeholders o join cosec.entities e on e.id = o.entity_id join cosec.parties p on p.id = o.party_id
 where o.ceased_on is not null and e.kind in ('company', 'public-company') and (e.jurisdiction = 'AU' or o.role <> 'secretary')
union all
select 'share ' || m.kind, m.id, e.id, e.name, e.jurisdiction,
       m.quantity || ' ' || m.share_class || coalesce(' to ' || tp.name, '') || coalesce(' from ' || fp.name, ''), m.on_date,
       case e.jurisdiction when 'NZ' then cosec.add_working_days(m.on_date, 10, 'NZ') else m.on_date + 28 end,
       m.notified_on,
       case e.jurisdiction when 'NZ' then 'NZ-SHARE-ISSUE-NOTICE' else 'AU-SHARE-NOTICE' end
  from cosec.share_movements m join cosec.entities e on e.id = m.entity_id
  left join cosec.parties tp on tp.id = m.to_party_id left join cosec.parties fp on fp.id = m.from_party_id
 where e.kind in ('company', 'public-company') and (e.jurisdiction = 'AU' or m.kind = 'issue');

-- The yearly cycle for each active company: NZ annual return and annual meeting, AU annual
-- review fee, statement check and solvency resolution.
create view cosec.annual_items as
with nz as (
  select e.*, make_date(extract(year from current_date)::int, e.filing_month, 1) as month_start,
         (make_date(extract(year from current_date)::int, e.filing_month, 1) + interval '1 month' - interval '1 day')::date as month_end,
         -- the latest balance date on or before today
         (case when (make_date(extract(year from current_date)::int, e.balance_month, 1) + interval '1 month' - interval '1 day')::date <= current_date
               then (make_date(extract(year from current_date)::int, e.balance_month, 1) + interval '1 month' - interval '1 day')::date
               else (make_date(extract(year from current_date)::int - 1, e.balance_month, 1) + interval '1 month' - interval '1 day')::date end) as last_balance
    from cosec.entities e where e.jurisdiction = 'NZ' and e.status = 'active' and e.kind in ('company', 'public-company')
), au as (
  select e.*,
         (e.incorporated_on + make_interval(years => (extract(year from age(current_date + 30, e.incorporated_on)))::int))::date as review_date
    from cosec.entities e where e.jurisdiction = 'AU' and e.status = 'active' and e.kind in ('company', 'public-company') and e.incorporated_on is not null
)
select nz.id as entity_id, nz.name as entity, nz.jurisdiction, nz.group_name, nz.responsible, 'annual return' as item,
       extract(year from current_date)::int::text as period, nz.month_start as opens_on, nz.month_end as due_on,
       f.filed_on as done_on, 'NZ-ANNUAL-RETURN' as rule
  from nz left join cosec.filings f on f.entity_id = nz.id and f.kind = 'annual-return' and f.period = extract(year from current_date)::int::text
 where nz.incorporated_on is null or extract(year from nz.incorporated_on) < extract(year from current_date)
union all
select nz.id, nz.name, nz.jurisdiction, nz.group_name, nz.responsible, 'annual meeting',
       'balance date ' || nz.last_balance, nz.last_balance,
       -- the first annual meeting may wait until 18 months after registration (s 120(2))
       case when lm.last_held is null and nz.incorporated_on > (nz.last_balance - interval '18 months') then (nz.incorporated_on + interval '18 months')::date
            else least((nz.last_balance + interval '6 months')::date, (coalesce(lm.last_held, nz.last_balance) + interval '15 months')::date) end,
       (select min(m.held_on) from cosec.meetings m where m.entity_id = nz.id and m.kind in ('annual-meeting', 'annual-resolution') and m.held_on > nz.last_balance),
       'NZ-ANNUAL-MEETING'
  from nz left join lateral (
    select max(m.held_on) as last_held from cosec.meetings m where m.entity_id = nz.id and m.kind in ('annual-meeting', 'annual-resolution') and m.held_on <= nz.last_balance
  ) lm on true
 where nz.incorporated_on is null or nz.incorporated_on < nz.last_balance
union all
select au.id, au.name, au.jurisdiction, au.group_name, au.responsible, 'annual review fee', extract(year from au.review_date)::int::text,
       au.review_date, (au.review_date + interval '2 months')::date, f.filed_on, 'AU-REVIEW-FEE'
  from au left join cosec.filings f on f.entity_id = au.id and f.kind = 'annual-review-fee' and f.period = extract(year from au.review_date)::int::text
 where au.review_date > au.incorporated_on
union all
select au.id, au.name, au.jurisdiction, au.group_name, au.responsible, 'annual statement checked', extract(year from au.review_date)::int::text,
       au.review_date, au.review_date + 28, f.filed_on, 'AU-STATEMENT-CHECK'
  from au left join cosec.filings f on f.entity_id = au.id and f.kind = 'statement-checked' and f.period = extract(year from au.review_date)::int::text
 where au.review_date > au.incorporated_on
union all
select au.id, au.name, au.jurisdiction, au.group_name, au.responsible, 'solvency resolution', extract(year from au.review_date)::int::text,
       au.review_date, (au.review_date + interval '2 months')::date,
       (select min(m.held_on) from cosec.meetings m where m.entity_id = au.id and m.kind = 'solvency-resolution' and m.held_on >= au.review_date - 14),
       'AU-SOLVENCY'
  from au where au.review_date > au.incorporated_on and not au.lodges_financial_reports;

-- Every rule as findings. severity: breached (past the deadline or missing now), due (deadline within 14 days).
create view cosec.compliance_findings as
select case when n.notified_on is null and n.due_on < current_date then 'breached'
            when n.notified_on is not null and n.notified_on > n.due_on then 'late'
            else 'due' end as severity,
       n.rule, n.entity_id, n.entity, n.detail || ' on ' || n.happened_on as item,
       case when n.notified_on is null then 'notice due ' || n.due_on || ' (' || (n.due_on - current_date) || ' days)'
            else 'notified ' || n.notified_on || ', ' || (n.notified_on - n.due_on) || ' days after the deadline ' || n.due_on end as finding,
       n.due_on as sort_on
  from cosec.notices n
 where (n.notified_on is null and n.due_on <= current_date + 14)
    or (n.notified_on is not null and n.notified_on > n.due_on and n.notified_on >= current_date - 90)
union all
select case when a.due_on < current_date then 'breached' else 'due' end, a.rule, a.entity_id, a.entity, a.item || ' ' || a.period,
       'due ' || a.due_on || ' (' || (a.due_on - current_date) || ' days)', a.due_on
  from cosec.annual_items a
 where a.done_on is null and a.due_on <= current_date + 14 and a.opens_on <= current_date + 14
union all
-- NZ s 10(d): at least one director living in New Zealand, or in Australia and directing an Australian company.
select 'breached', 'NZ-RESIDENT-DIRECTOR', e.id, e.name, 'directors: ' || coalesce((select string_agg(c.person || ' (' || coalesce(c.lives_in, '?') || ')', ', ' order by c.person) from cosec.current_officeholders c where c.entity_id = e.id and c.role = 'director'), 'none'),
       'no director lives in New Zealand, or in Australia while directing an Australian company', current_date
  from cosec.entities e
 where e.jurisdiction = 'NZ' and e.status = 'active' and e.kind in ('company', 'public-company')
   and not exists (select 1 from cosec.current_officeholders c where c.entity_id = e.id and c.role = 'director'
                    and (c.lives_in = 'NZ' or (c.lives_in = 'AU' and c.director_of_au_company)))
union all
-- AU s 201A: a proprietary company needs a director who ordinarily resides in Australia.
select 'breached', 'AU-RESIDENT-DIRECTOR', e.id, e.name, 'directors: ' || coalesce((select string_agg(c.person || ' (' || coalesce(c.lives_in, '?') || ')', ', ' order by c.person) from cosec.current_officeholders c where c.entity_id = e.id and c.role = 'director'), 'none'),
       'no director ordinarily resides in Australia', current_date
  from cosec.entities e
 where e.jurisdiction = 'AU' and e.status = 'active' and e.kind = 'company'
   and not exists (select 1 from cosec.current_officeholders c where c.entity_id = e.id and c.role = 'director' and c.lives_in = 'AU')
union all
-- AU s 1272C: every director of an Australian company holds a director ID.
select 'breached', 'AU-DIRECTOR-ID', c.entity_id, c.entity, c.person || ' (director since ' || c.appointed_on || ')', 'no director ID on file', c.appointed_on
  from cosec.current_officeholders c
 where c.jurisdiction = 'AU' and c.role in ('director', 'alternate-director') and c.director_id is null
union all
-- NZ s 152: written consent before appointment.
select 'breached', 'NZ-DIRECTOR-CONSENT', c.entity_id, c.entity, c.person || ' (director since ' || c.appointed_on || ')',
       case when c.consent_on is null then 'no signed consent on file' else 'consent dated ' || c.consent_on || ', after the appointment' end, c.appointed_on
  from cosec.current_officeholders c
 where c.jurisdiction = 'NZ' and c.role = 'director' and (c.consent_on is null or c.consent_on > c.appointed_on)
union all
-- AU s 251A: minutes recorded within one month.
select case when m.minutes_on is null and (m.held_on + interval '1 month')::date >= current_date then 'due' else 'breached' end,
       'AU-MINUTES', e.id, e.name, m.title || ' on ' || m.held_on,
       case when m.minutes_on is null then 'minutes not recorded, due ' || (m.held_on + interval '1 month')::date
            else 'minutes recorded ' || m.minutes_on || ', more than a month after the meeting' end,
       (m.held_on + interval '1 month')::date
  from cosec.meetings m join cosec.entities e on e.id = m.entity_id
 where e.jurisdiction = 'AU' and m.held_on >= current_date - 365
   and ((m.minutes_on is null and (m.held_on + interval '1 month')::date <= current_date + 14) or m.minutes_on > (m.held_on + interval '1 month')::date);

-- What needs a person this week, nearest deadline first.
create view cosec.attention as
select severity, rule, entity, item, finding, sort_on from cosec.compliance_findings
union all
select 'upcoming', a.rule, a.entity, a.item || ' ' || a.period, 'due ' || a.due_on || ' (' || (a.due_on - current_date) || ' days)', a.due_on
  from cosec.annual_items a
 where a.done_on is null and a.due_on > current_date + 14 and a.due_on <= current_date + 45;

alter table cosec.entities enable row level security;
alter table cosec.parties enable row level security;
alter table cosec.officeholders enable row level security;
alter table cosec.share_movements enable row level security;
alter table cosec.filings enable row level security;
alter table cosec.meetings enable row level security;
alter table cosec.holidays enable row level security;
alter table cosec.activity_log enable row level security;
