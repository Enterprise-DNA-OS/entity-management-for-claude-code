#!/usr/bin/env node
// The one CLI. Every slash command in .claude/commands drives this file.
//   npm run entities -- <command> [--flags] [--json]
// Human tables by default, --json for machines. Names match case-insensitively, by id
// prefix, or by a unique part of the name; an ambiguous match lists the candidates and exits 1.
// Shareholdings are never typed in: every holding is the sum of its issues, transfers and buy-backs.
// Deadlines are never typed in: the database works each one out from the rule and the date.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, heading } from './lib/format.mjs';

// ---------------------------------------------------------------- reads

export const reads = {
  entities: `select e.id, e.name as entity, e.jurisdiction as country, e.kind, e.company_number as number, e.status, e.group_name as client_group, e.responsible,
      (select count(*) from cosec.current_officeholders c where c.entity_id = e.id and c.role = 'director')::int as directors,
      (select count(*) from cosec.compliance_findings f where f.entity_id = e.id)::int as open_items
    from cosec.entities e order by e.status, e.group_name nulls last, e.name`,
  officers: `select c.entity, c.jurisdiction as country, c.person, c.role, c.appointed_on, c.lives_in, c.director_id
    from cosec.current_officeholders c order by c.entity, c.role, c.person`,
  people: `select p.id, p.name, p.kind, p.lives_in, p.director_id, p.email,
      (select count(*) from cosec.current_officeholders c where c.party_id = p.id)::int as offices,
      (select count(*) from cosec.holdings h where h.party_id = p.id)::int as holdings
    from cosec.parties p order by p.kind, p.name`,
  notices: `select n.change, n.entity, n.detail, n.happened_on, n.due_on, n.due_on - current_date as days_left, n.rule, n.source_id as id
    from cosec.notices n where n.notified_on is null order by n.due_on`,
  'annual-cycle': `select a.entity, a.jurisdiction as country, a.item, a.period, a.due_on,
      case when a.done_on is not null then 'done ' || a.done_on when a.due_on < current_date then 'LATE' when a.opens_on > current_date then 'not yet' else 'open' end as status,
      a.responsible
    from cosec.annual_items a order by (a.done_on is null) desc, a.due_on`,
  compliance: `select severity, rule, entity, item, finding from cosec.compliance_findings
    order by case severity when 'breached' then 0 when 'late' then 1 else 2 end, sort_on, entity`,
  attention: `select severity, entity, item, finding, rule from cosec.attention
    order by case severity when 'breached' then 0 when 'late' then 1 when 'due' then 2 else 3 end, sort_on, entity`,
  'director-ids': `select c.person, c.entity, c.appointed_on, coalesce(c.director_id, 'MISSING') as director_id, c.lives_in
    from cosec.current_officeholders c where c.jurisdiction = 'AU' and c.role in ('director', 'alternate-director')
    order by (c.director_id is null) desc, c.person, c.entity`,
  groups: `select coalesce(e.group_name, '(no group)') as client_group, count(*)::int as entities,
      count(*) filter (where e.jurisdiction = 'AU')::int as australian,
      coalesce(sum((select count(*) from cosec.compliance_findings f where f.entity_id = e.id and f.severity = 'breached')), 0)::int as breached,
      coalesce(sum((select count(*) from cosec.compliance_findings f where f.entity_id = e.id and f.severity <> 'breached')), 0)::int as due_soon,
      min(e.responsible) as responsible
    from cosec.entities e where e.status = 'active' group by e.group_name order by breached desc, due_soon desc, client_group`,
  holidays: `select on_date, jurisdiction, name from cosec.holidays where on_date >= current_date - 30 order by on_date`,
  history: `select created_at, actor, action, detail from cosec.activity_log order by id desc limit 50`,
};

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- argument parsing

export const specs = {
  ...Object.fromEntries(Object.keys(reads).map((k) => [k, []])),
  help: [],
  entity: ['entity'],
  person: ['person'],
  register: ['entity'],
  movements: ['entity'],
  filings: ['entity'],
  meetings: ['entity'],
  calendar: ['days'],
  workload: ['days'],
  structure: ['group'],
  'who-controls': ['entity'],
  'weekly-review': [],
  'add-entity': ['name', 'country', 'kind', 'number', 'incorporated', 'balance-month', 'filing-month', 'office', 'group', 'responsible', 'actor'],
  'update-entity': ['entity', 'name', 'number', 'status', 'balance-month', 'filing-month', 'office', 'group', 'responsible', 'reports', 'notes', 'actor'],
  'add-person': ['name', 'kind', 'lives-in', 'au-director', 'director-id', 'email', 'address', 'actor'],
  'update-person': ['person', 'lives-in', 'au-director', 'director-id', 'email', 'address', 'actor'],
  appoint: ['entity', 'person', 'role', 'date', 'consent', 'actor'],
  cease: ['entity', 'person', 'role', 'date', 'actor'],
  'issue-shares': ['entity', 'to', 'quantity', 'class', 'date', 'amount', 'reference', 'actor'],
  'transfer-shares': ['entity', 'from', 'to', 'quantity', 'class', 'date', 'amount', 'reference', 'actor'],
  'cancel-shares': ['entity', 'from', 'quantity', 'class', 'date', 'kind', 'reference', 'actor'],
  'mark-notified': ['id', 'date', 'actor'],
  file: ['entity', 'kind', 'period', 'date', 'reference', 'fee', 'notes', 'actor'],
  'record-meeting': ['entity', 'kind', 'date', 'title', 'outcome', 'minutes', 'actor'],
  'record-minutes': ['meeting', 'date', 'actor'],
  'add-holiday': ['date', 'country', 'name', 'actor'],
  'draft-reminder': ['group'],
  'draft-consent': ['entity', 'person'],
  'draft-solvency': ['entity'],
  'draft-annual-resolution': ['entity'],
  import: ['entities', 'appointments', 'shareholders', 'mapping', 'dates', 'dry-run', 'actor'],
  export: ['out'],
};

const FLAGS = new Set(['json', 'dry-run', 'help', 'au-director', 'reports']);

export function parse(args) {
  const pos = [];
  const o = {};
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (!x.startsWith('--')) { pos.push(x); continue; }
    const at = x.indexOf('=');
    const k = x.slice(2, at < 0 ? undefined : at);
    let v = at < 0 ? true : x.slice(at + 1);
    if (at < 0 && !FLAGS.has(k) && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) v = args[++i];
    if (k in o) throw Error(`Repeated --${k}`);
    o[k] = v;
  }
  let cmd = pos[0] || 'help';
  if (o.help) { cmd = 'help'; delete o.help; }
  if (!specs[cmd]) throw Error(`Unknown command "${cmd}". Run help for the list.`);
  if (cmd === 'import') {
    if (pos[1] !== 'diligent') throw Error('Use: import diligent --entities=<csv> [--appointments=<csv>] [--shareholders=<csv>] [--mapping=<json>] [--dates=dmy|mdy] [--dry-run]');
  } else if (pos.length > 1) {
    // One bare word after the command is the main record: `entity Kauri`, `person "Grace Liu"`.
    const main = specs[cmd][0];
    if (pos.length > 2 || !main || main in o) throw Error(`Unexpected argument "${pos[1]}"`);
    o[main] = pos[1];
  }
  for (const k of Object.keys(o)) {
    if (k !== 'json' && !specs[cmd].includes(k)) throw Error(`Unknown --${k} for ${cmd}`);
    if (FLAGS.has(k) && o[k] !== true && !['au-director', 'reports'].includes(k)) throw Error(`--${k} takes no value`);
  }
  return { cmd, o };
}

// ---------------------------------------------------------------- validation

const req = (o, k) => {
  if (typeof o[k] !== 'string' || !o[k].trim()) throw Error(`--${k} is required`);
  return o[k].trim();
};
const opt = (o, k) => (typeof o[k] === 'string' && o[k].trim() ? o[k].trim() : null);

export function date(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw Error(`Invalid date "${v}" (use YYYY-MM-DD)`);
  return v;
}
export function cents(v) {
  const s = String(v).replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error(`Invalid amount "${v}"`);
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n)) throw Error('Amount is too large');
  return n;
}
const whole = (v, what) => {
  const s = String(v).replace(/[,\s]/g, '');
  if (!/^\d+$/.test(s) || Number(s) <= 0) throw Error(`Invalid ${what} "${v}" (a whole number above zero)`);
  return Number(s);
};
const choice = (v, allowed, what) => {
  if (!allowed.includes(v)) throw Error(`${what} must be one of ${allowed.join(', ')}`);
  return v;
};
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export function month(v, what = 'month') {
  const s = String(v).trim().toLowerCase();
  if (/^\d{1,2}$/.test(s) && Number(s) >= 1 && Number(s) <= 12) return Number(s);
  const i = MONTHS.findIndex((m) => m === s || m.slice(0, 3) === s.slice(0, 3) && s.length >= 3 && m.startsWith(s));
  if (i < 0) throw Error(`Invalid ${what} "${v}" (a month name or 1 to 12)`);
  return i + 1;
}
const country = (v) => {
  const s = String(v).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) throw Error(`Country must be a two-letter code like NZ or AU, not "${v}"`);
  return s;
};
const bool = (v) => v === true || ['yes', 'true', 'y', '1'].includes(String(v).toLowerCase());

// ---------------------------------------------------------------- lookups

const KINDS = { entities: 'cosec.entities', people: 'cosec.parties' };

export async function resolve(db, kind, value) {
  const t = KINDS[kind];
  if (!t) throw Error(`Unknown record kind ${kind}`);
  const v = String(value).trim();
  let rows = await db.query(`select id, name from ${t} where lower(name) = lower($1) or ($2::text is not null and id::text like $2) order by name`,
    [v, /^[0-9a-f-]{4,36}$/i.test(v) ? `${v.toLowerCase()}%` : null]);
  if (!rows.length) rows = await db.query(`select id, name from ${t} where name ilike $1 order by name`, [`%${v.replace(/[%_]/g, '')}%`]);
  if (rows.length !== 1) {
    const list = rows.map((r) => `\n  ${String(r.id).slice(0, 8)}  ${r.name}`).join('');
    const e = Error(`${rows.length ? 'More than one' : 'No'} ${kind === 'people' ? 'person' : 'entity'} matches "${v}"${list}`);
    e.ambiguous = true;
    throw e;
  }
  return rows[0];
}
const entityRow = async (db, v) => (await db.query('select * from cosec.entities where id = $1', [(await resolve(db, 'entities', v)).id]))[0];
const partyRow = async (db, v) => (await db.query('select * from cosec.parties where id = $1', [(await resolve(db, 'people', v)).id]))[0];

const log = (db, actor, action, detail) => db.query('insert into cosec.activity_log (actor, action, detail) values ($1, $2, $3)', [actor, action, detail]);
const who = (o) => opt(o, 'actor') || 'operator';

async function tx(db, fn) {
  await db.exec('BEGIN');
  try {
    const r = await fn();
    await db.exec('COMMIT');
    return r;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

function writeDraft(name, body) {
  const dir = path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${today()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.md`);
  fs.writeFileSync(file, body);
  return file;
}

const brand = () => {
  try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')); } catch { return {}; }
};

// ---------------------------------------------------------------- the reports

async function entityCard(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  return {
    entity: e.name, country: e.jurisdiction, number: e.company_number, status: e.status, incorporated: e.incorporated_on,
    balance_month: MONTHS[e.balance_month - 1], filing_month: e.filing_month ? MONTHS[e.filing_month - 1] : null,
    registered_office: e.registered_office, client_group: e.group_name, responsible: e.responsible,
    officers: await db.query(`select person, role, appointed_on, lives_in, director_id from cosec.current_officeholders where entity_id = $1 order by role, person`, [e.id]),
    register: await db.query(`select holder, share_class, shares, pct_of_class from cosec.holdings where entity_id = $1 order by share_class, shares desc`, [e.id]),
    annual: await db.query(`select item, period, due_on, coalesce('done ' || done_on, case when due_on < current_date then 'LATE' else 'open' end) as status from cosec.annual_items where entity_id = $1 order by due_on`, [e.id]),
    open_items: await db.query(`select severity, rule, item, finding from cosec.compliance_findings where entity_id = $1 order by sort_on`, [e.id]),
  };
}

async function personCard(db, o) {
  const p = await partyRow(db, req(o, 'person'));
  return {
    person: p.name, kind: p.kind, lives_in: p.lives_in, director_id: p.director_id, email: p.email,
    offices: await db.query(`select e.name as entity, e.jurisdiction as country, o.role, o.appointed_on, o.ceased_on
      from cosec.officeholders o join cosec.entities e on e.id = o.entity_id where o.party_id = $1 order by (o.ceased_on is null) desc, e.name`, [p.id]),
    holdings: await db.query(`select entity, share_class, shares, pct_of_class from cosec.holdings where party_id = $1 order by entity`, [p.id]),
    owns_through_companies: (await lookThroughAll(db)).filter((r) => r.ultimate_holder === p.name && r.via !== 'direct')
      .map(({ entity, effective_pct, via }) => ({ entity, effective_pct, via })),
  };
}

async function register(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  return db.query(`select holder, holder_kind as kind, share_class, shares, pct_of_class from cosec.holdings where entity_id = $1 order by share_class, shares desc`, [e.id]);
}

async function movements(db, o) {
  const e = opt(o, 'entity') ? await entityRow(db, o.entity) : null;
  return db.query(`select m.on_date, e.name as entity, m.kind, m.quantity, m.share_class, fp.name as from_holder, tp.name as to_holder, m.consideration_cents, m.notified_on, m.reference
    from cosec.share_movements m join cosec.entities e on e.id = m.entity_id
    left join cosec.parties fp on fp.id = m.from_party_id left join cosec.parties tp on tp.id = m.to_party_id
    where $1::uuid is null or m.entity_id = $1 order by m.on_date desc, e.name`, [e?.id || null]);
}

async function filings(db, o) {
  const e = opt(o, 'entity') ? await entityRow(db, o.entity) : null;
  return db.query(`select f.filed_on, e.name as entity, f.kind, f.period, f.reference, f.fee_cents, e.jurisdiction as currency_country
    from cosec.filings f join cosec.entities e on e.id = f.entity_id where $1::uuid is null or f.entity_id = $1 order by f.filed_on desc limit 100`, [e?.id || null]);
}

async function meetings(db, o) {
  const e = opt(o, 'entity') ? await entityRow(db, o.entity) : null;
  return db.query(`select m.id, m.held_on, e.name as entity, m.kind, m.title, m.outcome, m.minutes_on
    from cosec.meetings m join cosec.entities e on e.id = m.entity_id where $1::uuid is null or m.entity_id = $1 order by m.held_on desc limit 100`, [e?.id || null]);
}

async function calendar(db, o) {
  const days = Math.min(400, Math.max(1, Number(opt(o, 'days') || 60)));
  return db.query(`select due_on, due_on - current_date as days_left, entity, what, rule, responsible from (
      select a.due_on, a.entity, a.item || ' ' || a.period as what, a.rule, a.responsible from cosec.annual_items a where a.done_on is null
      union all
      select n.due_on, n.entity, 'notify: ' || n.detail, n.rule, e.responsible from cosec.notices n join cosec.entities e on e.id = n.entity_id where n.notified_on is null
    ) x where due_on <= current_date + $1::int order by due_on, entity`, [days]);
}

async function workload(db, o) {
  const days = Math.min(400, Math.max(1, Number(opt(o, 'days') || 30)));
  const rows = await calendar(db, { days: String(days) });
  const by = new Map();
  for (const r of rows) {
    const k = r.responsible || '(nobody)';
    const x = by.get(k) || { responsible: k, late: 0, due: 0, next_due: null, next_item: null };
    if (r.days_left < 0) x.late++; else x.due++;
    if (r.days_left >= 0 && (!x.next_due || r.due_on < x.next_due)) { x.next_due = r.due_on; x.next_item = `${r.entity}: ${r.what}`; }
    by.set(k, x);
  }
  return [...by.values()].sort((a, b) => b.late - a.late || b.due - a.due);
}

// Look through every company we hold records for to the people and trusts at the top.
async function lookThroughAll(db) {
  const holds = await db.query('select entity_id, entity, holder, holder_entity_id, sum(shares)::bigint as shares from cosec.holdings group by entity_id, entity, holder, holder_entity_id');
  const byEntity = new Map();
  for (const h of holds) {
    const list = byEntity.get(h.entity_id) || [];
    list.push(h);
    byEntity.set(h.entity_id, list);
  }
  const out = [];
  for (const [entityId, list] of byEntity) {
    const walk = (id, share, trail, seen) => {
      const rows = byEntity.get(id) || [];
      const total = rows.reduce((s, r) => s + Number(r.shares), 0);
      for (const r of rows) {
        const part = share * Number(r.shares) / (total || 1);
        if (r.holder_entity_id && byEntity.has(r.holder_entity_id) && !seen.has(r.holder_entity_id)) {
          walk(r.holder_entity_id, part, [...trail, r.holder], new Set([...seen, r.holder_entity_id]));
        } else {
          out.push({ entity: list[0].entity, entity_id: entityId, ultimate_holder: r.holder, effective_pct: Math.round(part * 10000) / 100, via: trail.length ? trail.join(' > ') : 'direct' });
        }
      }
    };
    walk(entityId, 1, [], new Set([entityId]));
  }
  return out;
}

async function whoControls(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const rows = (await lookThroughAll(db)).filter((r) => r.entity_id === e.id);
  const merged = new Map();
  for (const r of rows) {
    const x = merged.get(r.ultimate_holder) || { ultimate_holder: r.ultimate_holder, effective_pct: 0, via: [] };
    x.effective_pct = Math.round((x.effective_pct + r.effective_pct) * 100) / 100;
    x.via.push(r.via);
    merged.set(r.ultimate_holder, x);
  }
  return [...merged.values()].map((x) => ({ ...x, via: x.via.join('; ') })).sort((a, b) => b.effective_pct - a.effective_pct || a.ultimate_holder.localeCompare(b.ultimate_holder));
}

async function structure(db, o) {
  const g = opt(o, 'group');
  const ents = await db.query(`select id, name, jurisdiction from cosec.entities where status = 'active' and ($1::text is null or group_name ilike $1) order by name`, [g ? `%${g.replace(/[%_]/g, '')}%` : null]);
  if (!ents.length) throw Error(`No active entities in a group matching "${g}"`);
  const ids = new Set(ents.map((e) => e.id));
  const holds = await db.query('select entity_id, holder, holder_entity_id, pct_of_class, share_class from cosec.holdings');
  const owners = (id) => holds.filter((h) => h.entity_id === id);
  const children = (id) => holds.filter((h) => h.holder_entity_id === id && ids.has(h.entity_id));
  const name = new Map(ents.map((e) => [e.id, `${e.name} (${e.jurisdiction})`]));
  const lines = [];
  const draw = (id, depth, pct, seen) => {
    const pad = '    '.repeat(depth);
    lines.push(`${pad}${depth ? `${pct}% > ` : ''}${name.get(id)}`);
    for (const h of owners(id).filter((x) => !x.holder_entity_id || !ids.has(x.holder_entity_id))) lines.push(`${pad}    held by ${h.holder} ${Number(h.pct_of_class)}% ${h.share_class}`);
    for (const c of children(id)) if (!seen.has(c.entity_id)) draw(c.entity_id, depth + 1, Number(c.pct_of_class), new Set([...seen, c.entity_id]));
  };
  const tops = ents.filter((e) => !owners(e.id).some((h) => h.holder_entity_id && ids.has(h.holder_entity_id)));
  for (const t of tops) draw(t.id, 0, 100, new Set([t.id]));
  return { group: g || 'all groups', lines };
}

async function weeklyReview(db) {
  return {
    'Needs a person': await db.query(reads.attention),
    'Changes the registry has not heard about': await db.query(reads.notices),
    'Due in the next 30 days': await calendar(db, { days: '30' }),
    'By client group': await db.query(reads.groups),
    'By staff member': await workload(db, { days: '30' }),
  };
}

// ---------------------------------------------------------------- writes

async function addEntity(db, o) {
  const name = req(o, 'name');
  const jur = choice(country(req(o, 'country')), ['NZ', 'AU'], 'Country');
  const kind = choice(opt(o, 'kind') || 'company', ['company', 'public-company', 'trust', 'partnership', 'other'], 'Kind');
  const inc = opt(o, 'incorporated') ? date(o.incorporated) : null;
  const filing = opt(o, 'filing-month') ? month(o['filing-month'], 'filing month') : null;
  if (jur === 'NZ' && ['company', 'public-company'].includes(kind) && !filing) throw Error('A New Zealand company needs --filing-month (the month its annual return is due, shown on the Companies Register)');
  if (jur === 'AU' && ['company', 'public-company'].includes(kind) && !inc) throw Error('An Australian company needs --incorporated: its annual review date is the anniversary');
  return tx(db, async () => {
    const r = (await db.query(`insert into cosec.entities (name, jurisdiction, kind, company_number, incorporated_on, balance_month, filing_month, registered_office, group_name, responsible)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id, name`,
    [name, jur, kind, opt(o, 'number'), inc, opt(o, 'balance-month') ? month(o['balance-month'], 'balance month') : 3, filing, opt(o, 'office'), opt(o, 'group'), opt(o, 'responsible')]))[0];
    await log(db, who(o), 'add-entity', `${name} (${jur})`);
    return { added: r.name, id: r.id };
  });
}

async function updateEntity(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const sets = [];
  const vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (opt(o, 'name')) set('name', o.name.trim());
  if (opt(o, 'number')) set('company_number', o.number.trim());
  if (opt(o, 'status')) set('status', choice(o.status, ['active', 'removed', 'in-liquidation'], 'Status'));
  if (opt(o, 'balance-month')) set('balance_month', month(o['balance-month'], 'balance month'));
  if (opt(o, 'filing-month')) set('filing_month', month(o['filing-month'], 'filing month'));
  if (opt(o, 'office')) set('registered_office', o.office.trim());
  if (opt(o, 'group')) set('group_name', o.group.trim());
  if (opt(o, 'responsible')) set('responsible', o.responsible.trim());
  if (o.reports !== undefined) set('lodges_financial_reports', bool(o.reports));
  if (opt(o, 'notes')) set('notes', o.notes.trim());
  if (!sets.length) throw Error('Nothing to change');
  return tx(db, async () => {
    vals.push(e.id);
    await db.query(`update cosec.entities set ${sets.join(', ')} where id = $${vals.length}`, vals);
    await log(db, who(o), 'update-entity', `${e.name}: ${sets.map((s) => s.split(' = ')[0]).join(', ')}`);
    return { updated: e.name, changed: sets.map((s) => s.split(' = ')[0]) };
  });
}

async function addPerson(db, o) {
  const name = req(o, 'name');
  const kind = choice(opt(o, 'kind') || 'individual', ['individual', 'company', 'trust'], 'Kind');
  const did = opt(o, 'director-id');
  if (did && !/^\d{15}$/.test(did)) throw Error('A director ID is 15 digits');
  let entityId = null;
  if (kind !== 'individual') entityId = (await db.query('select id from cosec.entities where lower(name) = lower($1)', [name]))[0]?.id || null;
  return tx(db, async () => {
    const r = (await db.query(`insert into cosec.parties (name, kind, entity_id, lives_in, director_of_au_company, director_id, email, address)
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, name`,
    [name, kind, entityId, opt(o, 'lives-in') ? country(o['lives-in']) : null, o['au-director'] !== undefined && bool(o['au-director']), did, opt(o, 'email'), opt(o, 'address')]))[0];
    await log(db, who(o), 'add-person', `${name} (${kind})`);
    return { added: r.name, id: r.id, linked_entity: Boolean(entityId) };
  });
}

async function updatePerson(db, o) {
  const p = await partyRow(db, req(o, 'person'));
  const sets = [];
  const vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (opt(o, 'lives-in')) set('lives_in', country(o['lives-in']));
  if (o['au-director'] !== undefined) set('director_of_au_company', bool(o['au-director']));
  if (opt(o, 'director-id')) {
    if (!/^\d{15}$/.test(o['director-id'].trim())) throw Error('A director ID is 15 digits');
    set('director_id', o['director-id'].trim());
  }
  if (opt(o, 'email')) set('email', o.email.trim());
  if (opt(o, 'address')) set('address', o.address.trim());
  if (!sets.length) throw Error('Nothing to change');
  return tx(db, async () => {
    vals.push(p.id);
    await db.query(`update cosec.parties set ${sets.join(', ')} where id = $${vals.length}`, vals);
    await log(db, who(o), 'update-person', `${p.name}: ${sets.map((s) => s.split(' = ')[0]).join(', ')}`);
    return { updated: p.name, changed: sets.map((s) => s.split(' = ')[0]) };
  });
}

async function appoint(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const p = await partyRow(db, req(o, 'person'));
  const role = choice(opt(o, 'role') || 'director', ['director', 'secretary', 'alternate-director'], 'Role');
  const on = date(opt(o, 'date') || today());
  const consent = opt(o, 'consent') ? date(o.consent) : null;
  const warnings = [];
  if (e.jurisdiction === 'NZ' && role === 'director' && (!consent || consent > on)) warnings.push('No signed consent dated on or before the appointment: the Companies Act 1993 s 152 needs one first. Use draft-consent.');
  if (e.jurisdiction === 'AU' && role !== 'secretary' && !p.director_id) warnings.push('No director ID on file: Corporations Act s 1272C needs one before appointment. Record it with update-person --director-id.');
  return tx(db, async () => {
    const r = (await db.query(`insert into cosec.officeholders (entity_id, party_id, role, appointed_on, consent_on) values ($1, $2, $3, $4, $5) returning id`, [e.id, p.id, role, on, consent]))[0];
    await log(db, who(o), 'appoint', `${p.name} as ${role} of ${e.name} from ${on}`);
    const due = (await db.query('select due_on from cosec.notices where source_id = $1 and change = $2', [r.id, 'appointment']))[0]?.due_on || null;
    return { appointed: p.name, role, entity: e.name, from: on, notify_registry_by: due, warnings };
  });
}

async function cease(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const p = await partyRow(db, req(o, 'person'));
  const role = choice(opt(o, 'role') || 'director', ['director', 'secretary', 'alternate-director'], 'Role');
  const on = date(opt(o, 'date') || today());
  const row = (await db.query('select id, appointed_on from cosec.officeholders where entity_id = $1 and party_id = $2 and role = $3 and ceased_on is null', [e.id, p.id, role]))[0];
  if (!row) throw Error(`${p.name} is not a current ${role} of ${e.name}`);
  if (on < row.appointed_on) throw Error(`${p.name} was appointed on ${row.appointed_on}, after ${on}`);
  return tx(db, async () => {
    await db.query('update cosec.officeholders set ceased_on = $1 where id = $2', [on, row.id]);
    await log(db, who(o), 'cease', `${p.name} ceased as ${role} of ${e.name} on ${on}`);
    const due = (await db.query('select due_on from cosec.notices where source_id = $1 and change = $2', [row.id, 'cessation']))[0]?.due_on || null;
    const left = (await db.query(`select count(*)::int as n from cosec.current_officeholders where entity_id = $1 and role = 'director'`, [e.id]))[0].n;
    return { ceased: p.name, role, entity: e.name, on, notify_registry_by: due, directors_left: left };
  });
}

async function movement(db, o, kind) {
  const e = await entityRow(db, req(o, 'entity'));
  const qty = whole(req(o, 'quantity'), 'quantity');
  const cls = (opt(o, 'class') || 'ORD').toUpperCase();
  const on = date(opt(o, 'date') || today());
  const to = kind === 'issue' || kind === 'transfer' ? await partyRow(db, req(o, 'to')) : null;
  const from = kind === 'issue' ? null : await partyRow(db, req(o, 'from'));
  const k = kind === 'cancel' ? choice(opt(o, 'kind') || 'buy-back', ['buy-back', 'cancellation'], 'Kind') : kind;
  return tx(db, async () => {
    const r = (await db.query(`insert into cosec.share_movements (entity_id, kind, share_class, quantity, from_party_id, to_party_id, on_date, consideration_cents, reference)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [e.id, k, cls, qty, from?.id || null, to?.id || null, on, opt(o, 'amount') ? cents(o.amount) : null, opt(o, 'reference')]))[0];
    await log(db, who(o), k, `${e.name}: ${qty} ${cls}${from ? ` from ${from.name}` : ''}${to ? ` to ${to.name}` : ''} on ${on}`);
    const due = (await db.query('select due_on from cosec.notices where source_id = $1', [r.id]))[0]?.due_on || null;
    return { entity: e.name, [k]: `${qty} ${cls}`, from: from?.name || null, to: to?.name || null, on, notify_registry_by: due, register: await register(db, { entity: e.id }) };
  });
}

async function markNotified(db, o) {
  const id = req(o, 'id').toLowerCase();
  const on = date(opt(o, 'date') || today());
  const hits = await db.query('select * from cosec.notices where source_id::text like $1', [`${id}%`]);
  const open = hits.filter((h) => !h.notified_on);
  if (open.length !== 1) throw Error(open.length ? `More than one open notice starts with ${id}: give more of the id` : `No open notice starts with ${id}. Run notices for the list.`);
  const n = open[0];
  return tx(db, async () => {
    if (n.change === 'appointment') await db.query('update cosec.officeholders set appointment_notified_on = $1 where id = $2', [on, n.source_id]);
    else if (n.change === 'cessation') await db.query('update cosec.officeholders set ceased_notified_on = $1 where id = $2', [on, n.source_id]);
    else await db.query('update cosec.share_movements set notified_on = $1 where id = $2', [on, n.source_id]);
    await log(db, who(o), 'mark-notified', `${n.entity}: ${n.detail}, notified ${on}`);
    return { entity: n.entity, change: n.detail, notified_on: on, due_on: n.due_on, late_by_days: on > n.due_on ? (new Date(on) - new Date(n.due_on)) / 86400000 : 0 };
  });
}

async function file(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const kind = choice(req(o, 'kind'), ['annual-return', 'annual-review-fee', 'statement-checked', 'address-change', 'name-change', 'constitution', 'other'], 'Kind');
  const on = date(opt(o, 'date') || today());
  let period = opt(o, 'period');
  if (!period && kind === 'annual-return') period = on.slice(0, 4);
  if (!period && ['annual-review-fee', 'statement-checked'].includes(kind)) {
    period = (await db.query(`select period from cosec.annual_items where entity_id = $1 and rule in ('AU-REVIEW-FEE', 'AU-STATEMENT-CHECK') order by due_on desc limit 1`, [e.id]))[0]?.period || on.slice(0, 4);
  }
  if (kind === 'annual-return' && e.jurisdiction !== 'NZ') throw Error('Annual returns are for New Zealand companies; an Australian company pays its annual review fee (kind annual-review-fee)');
  if (['annual-review-fee', 'statement-checked'].includes(kind) && e.jurisdiction !== 'AU') throw Error(`${kind} is for Australian companies`);
  return tx(db, async () => {
    await db.query(`insert into cosec.filings (entity_id, kind, period, filed_on, reference, fee_cents, notes) values ($1, $2, $3, $4, $5, $6, $7)`,
      [e.id, kind, period, on, opt(o, 'reference'), opt(o, 'fee') ? cents(o.fee) : null, opt(o, 'notes')]);
    await log(db, who(o), 'file', `${e.name}: ${kind}${period ? ` ${period}` : ''} on ${on}`);
    return { entity: e.name, filed: kind, period, on };
  });
}

async function recordMeeting(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const kind = choice(req(o, 'kind'), ['board', 'shareholders', 'annual-meeting', 'annual-resolution', 'solvency-resolution', 'written-resolution'], 'Kind');
  const on = date(opt(o, 'date') || today());
  const outcome = kind === 'solvency-resolution' ? choice(opt(o, 'outcome') || 'positive', ['positive', 'negative'], 'Outcome') : opt(o, 'outcome');
  const minutes = opt(o, 'minutes') ? date(o.minutes) : (['annual-resolution', 'written-resolution', 'solvency-resolution'].includes(kind) ? on : null);
  const title = opt(o, 'title') || { 'annual-resolution': 'Annual written resolution in lieu of meeting', 'solvency-resolution': "Directors' solvency resolution", 'annual-meeting': 'Annual meeting of shareholders' }[kind];
  if (!title) throw Error('--title is required');
  const warnings = [];
  if (kind === 'solvency-resolution' && e.jurisdiction !== 'AU') throw Error('A solvency resolution under s 347A is for Australian companies');
  if (kind === 'solvency-resolution' && outcome === 'negative') warnings.push('A negative solvency resolution must be lodged with ASIC within 7 days. Get advice today.');
  return tx(db, async () => {
    const r = (await db.query(`insert into cosec.meetings (entity_id, kind, held_on, title, outcome, minutes_on) values ($1, $2, $3, $4, $5, $6) returning id`, [e.id, kind, on, title, outcome, minutes]))[0];
    await log(db, who(o), 'record-meeting', `${e.name}: ${title} on ${on}`);
    return { entity: e.name, recorded: title, on, id: r.id, minutes_recorded: minutes, warnings };
  });
}

async function recordMinutes(db, o) {
  const id = req(o, 'meeting').toLowerCase();
  const on = date(opt(o, 'date') || today());
  const rows = await db.query('select m.*, e.name as entity from cosec.meetings m join cosec.entities e on e.id = m.entity_id where m.id::text like $1', [`${id}%`]);
  if (rows.length !== 1) throw Error(rows.length ? `More than one meeting starts with ${id}` : `No meeting starts with ${id}. Run meetings for the list.`);
  const m = rows[0];
  if (on < m.held_on) throw Error(`The meeting was held on ${m.held_on}`);
  return tx(db, async () => {
    await db.query('update cosec.meetings set minutes_on = $1 where id = $2', [on, m.id]);
    await log(db, who(o), 'record-minutes', `${m.entity}: ${m.title}, minutes ${on}`);
    return { entity: m.entity, meeting: m.title, held_on: m.held_on, minutes_on: on };
  });
}

async function addHoliday(db, o) {
  const on = date(req(o, 'date'));
  const jur = choice(country(opt(o, 'country') || 'NZ'), ['NZ', 'AU'], 'Country');
  const name = req(o, 'name');
  return tx(db, async () => {
    await db.query('insert into cosec.holidays (on_date, jurisdiction, name) values ($1, $2, $3) on conflict (on_date, jurisdiction) do update set name = excluded.name', [on, jur, name]);
    await log(db, who(o), 'add-holiday', `${jur} ${on} ${name}`);
    return { holiday: name, on, country: jur };
  });
}

// ---------------------------------------------------------------- drafts (never sent)

async function draftReminder(db, o) {
  const g = req(o, 'group');
  const ents = await db.query(`select id, name from cosec.entities where status = 'active' and group_name ilike $1 order by name`, [`%${g.replace(/[%_]/g, '')}%`]);
  if (!ents.length) throw Error(`No active entities in a group matching "${g}"`);
  const groupName = (await db.query('select group_name from cosec.entities where id = $1', [ents[0].id]))[0].group_name;
  const ids = ents.map((e) => e.id);
  const items = await db.query(`select entity, item, finding, severity, rule from cosec.attention a join cosec.entities e on e.name = a.entity where e.id = any($1::uuid[]) order by sort_on`, [ids]);
  const ask = {
    'NZ-ANNUAL-RETURN': 'confirm the shareholders and directors have not changed, and any new addresses, so we can file the annual return',
    'NZ-ANNUAL-MEETING': 'sign the annual written resolution we will send, or tell us the date of the meeting',
    'AU-REVIEW-FEE': 'approve payment of the ASIC annual review fee',
    'AU-SOLVENCY': 'the directors sign the solvency resolution, or tell us if the company may not be able to pay its debts as they fall due',
    'AU-RESIDENT-DIRECTOR': 'tell us who will act as the Australian-resident director',
    'AU-DIRECTOR-ID': 'send the director ID (15 digits, from the Australian Business Registry Services)',
    'NZ-DIRECTOR-CONSENT': 'sign the director consent form we will send',
    'AU-MINUTES': 'approve the minutes we will send',
  };
  const firm = brand().business_name || '[your firm]';
  const lines = items.map((i) => `- **${i.entity}**: ${i.item}. ${i.finding}.${ask[i.rule] ? ` What we need from you: ${ask[i.rule]}.` : ''}`);
  const body = `# Draft: company secretarial reminder for the ${groupName} group\n\nTo: [client contact]\nFrom: ${firm}\nSubject: ${groupName}: company filings due\n\nHi [name],\n\n${items.length
    ? `Here is what is coming up for your companies, and what we need from you.\n\n${lines.join('\n')}\n\nIf anything has changed (a new director, a new address, shares sold or issued), let us know and we will file it.`
    : 'Nothing is due for your companies in the next six weeks. If anything has changed (a new director, a new address, shares sold or issued), let us know and we will file it.'}\n\nThanks,\n[your name]\n${firm}\n\n<!-- Draft only. A person reads and sends it. -->\n`;
  return { group: groupName, items: items.length, draft: writeDraft(`reminder-${groupName}`, body) };
}

async function draftConsent(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  const p = await partyRow(db, req(o, 'person'));
  if (e.jurisdiction !== 'NZ') throw Error('The consent and certificate form is for New Zealand companies (Companies Act 1993 s 152)');
  const body = `# Draft: consent and certificate of director\n\n**Company:** ${e.name}${e.company_number ? ` (${e.company_number})` : ''}\n\nI, **${p.name}**, of ${p.address || '[residential address]'}, consent to being a director of ${e.name} under section 152 of the Companies Act 1993, and certify that I am not disqualified from being appointed or holding office as a director of a company.\n\n**Date of birth:** [date]\n**Place of birth:** [town and country]\n\nSigned: ______________________   Date: ____________\n\nFile this on the Companies Register as part of the director change notice (s 159), within 20 working days of the appointment.\n\n<!-- Draft only. Check the current Companies Office form before it is signed. -->\n`;
  return { entity: e.name, person: p.name, draft: writeDraft(`consent-${p.name}-${e.name}`, body) };
}

async function draftSolvency(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  if (e.jurisdiction !== 'AU') throw Error('The solvency resolution under s 347A is for Australian companies');
  const item = (await db.query(`select review_date, due_on from (select opens_on as review_date, due_on from cosec.annual_items where entity_id = $1 and rule = 'AU-SOLVENCY') x order by review_date desc limit 1`, [e.id]))[0];
  const dirs = await db.query(`select person from cosec.current_officeholders where entity_id = $1 and role = 'director' order by person`, [e.id]);
  const body = `# Draft: directors' solvency resolution\n\n**${e.name}**${e.company_number ? ` (ACN ${e.company_number})` : ''}\n\nResolution of the directors under section 347A of the Corporations Act 2001${item ? `, for the annual review date ${item.review_date}` : ''}.\n\nThe directors resolve that, in their opinion, there are reasonable grounds to believe that the company will be able to pay its debts as and when they become due and payable.\n\n${dirs.map((d) => `${d.person}, director: ______________________   Date: ____________`).join('\n\n')}\n\n${item ? `Pass by ${item.due_on}. ` : ''}Keep it with the minutes. A positive resolution is not lodged with ASIC. If the directors cannot pass it, a negative resolution must be lodged within 7 days: take advice before it is signed.\n\n<!-- Draft only. Record it with record-meeting --kind=solvency-resolution once signed. -->\n`;
  return { entity: e.name, directors: dirs.length, draft: writeDraft(`solvency-${e.name}`, body) };
}

async function draftAnnualResolution(db, o) {
  const e = await entityRow(db, req(o, 'entity'));
  if (e.jurisdiction !== 'NZ') throw Error('The written resolution in lieu of an annual meeting (s 122) is for New Zealand companies');
  const holders = await db.query(`select holder, sum(shares)::bigint as shares from cosec.holdings where entity_id = $1 group by holder order by shares desc`, [e.id]);
  const item = (await db.query(`select period, due_on from cosec.annual_items where entity_id = $1 and rule = 'NZ-ANNUAL-MEETING'`, [e.id]))[0];
  const body = `# Draft: shareholders' written resolution in lieu of annual meeting\n\n**${e.name}**${e.company_number ? ` (${e.company_number})` : ''}\n\nResolution of the shareholders under section 122 of the Companies Act 1993, in lieu of the annual meeting under section 120${item ? ` (${item.period}, due by ${item.due_on})` : ''}.\n\nThe shareholders resolve:\n\n1. That the financial statements for the year ending on the balance date are received.\n2. That, under section 196(2), the company will not appoint an auditor for the coming year. [delete if an auditor is required]\n3. [any other business]\n\n${holders.map((h) => `${h.holder} (${h.shares} shares): ______________________   Date: ____________`).join('\n\n')}\n\n<!-- Draft only. Record it with record-meeting --kind=annual-resolution once every shareholder has signed. -->\n`;
  return { entity: e.name, shareholders: holders.length, draft: writeDraft(`annual-resolution-${e.name}`, body) };
}

// ---------------------------------------------------------------- import from Diligent Entities

const COUNTRY = { 'new zealand': 'NZ', nz: 'NZ', nzl: 'NZ', australia: 'AU', au: 'AU', aus: 'AU' };
const MON3 = MONTHS.map((m) => m.slice(0, 3));

export function anyDate(v, order = 'dmy') {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return date(`${m[1]}-${m[2]}-${m[3]}`);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const [d, mo] = order === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
    return date(`${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{4})$/);
  if (m && MON3.includes(m[2].slice(0, 3).toLowerCase())) return date(`${m[3]}-${String(MON3.indexOf(m[2].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  throw Error(`Unreadable date "${s}"`);
}

const holderKind = (name, ourNames) => {
  if (/\btrust\b|\btrustees?\b/i.test(name)) return 'trust';
  if (ourNames.has(name.toLowerCase())) return 'company';
  if (/\b(limited|ltd|pty|inc|llc|plc|corporation|company)\b/i.test(name)) return 'company';
  return 'individual';
};

function readCsv(file, mapping) {
  const rows = parseCsv(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!mapping) return rows;
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [mapping[k] || k, v])));
}

async function importDiligent(db, o) {
  const order = choice(opt(o, 'dates') || 'dmy', ['dmy', 'mdy'], 'Dates');
  const mapping = opt(o, 'mapping') ? JSON.parse(fs.readFileSync(path.resolve(o.mapping), 'utf8')) : null;
  const actor = who(o);
  const dry = Boolean(o['dry-run']);
  if (!opt(o, 'entities') && !opt(o, 'appointments') && !opt(o, 'shareholders')) throw Error('Give at least one of --entities, --appointments, --shareholders');
  const result = { dry_run: dry, entities_created: [], entities_existing: 0, people_created: [], appointments_created: 0, appointments_existing: 0, holdings_created: 0, holdings_skipped: 0, problems: [] };
  await db.exec('BEGIN');
  try {
    if (opt(o, 'entities')) {
      const rows = readCsv(o.entities, mapping);
      for (const [i, r] of rows.entries()) {
        const at = `entities row ${i + 2}`;
        const name = pick(r, 'Name', 'Company Name', 'Entity Name', 'Entity');
        if (!name) { result.problems.push(`${at}: no name`); continue; }
        const jur = COUNTRY[pick(r, 'Country', 'Jurisdiction', 'Country of Incorporation').trim().toLowerCase()];
        if (!jur) { result.problems.push(`${at} ${name}: country "${pick(r, 'Country', 'Jurisdiction', 'Country of Incorporation')}" is not New Zealand or Australia, skipped`); continue; }
        if ((await db.query('select 1 from cosec.entities where lower(name) = lower($1)', [name])).length) { result.entities_existing++; continue; }
        const type = pick(r, 'Entity Type', 'Company Type', 'Type').toLowerCase();
        const kind = /trust/.test(type) ? 'trust' : /partnership/.test(type) ? 'partnership' : /public/.test(type) ? 'public-company' : /company|limited|ltd|pty|proprietary/.test(type) || !type ? 'company' : 'other';
        const st = pick(r, 'Status', 'Company Status').toLowerCase();
        const status = /liquidat/.test(st) ? 'in-liquidation' : /remov|deregist|struck|dissolv|closed|inactive/.test(st) ? 'removed' : 'active';
        let inc = null;
        try { inc = anyDate(pick(r, 'Date of Incorporation', 'Incorporation Date', 'Date Incorporated', 'Registration Date'), order); } catch (e) { result.problems.push(`${at} ${name}: ${e.message}`); }
        const balRaw = pick(r, 'Balance Date', 'Financial Year End', 'Year End');
        let bal = 3;
        if (balRaw) {
          const words = balRaw.match(/[A-Za-z]{3,}/);
          const nums = balRaw.match(/^\d{1,2}[/.-](\d{1,2})$/);
          try { bal = words ? month(words[0]) : nums ? month(nums[1]) : month(balRaw); } catch { result.problems.push(`${at} ${name}: balance date "${balRaw}" not read, set to March`); }
        }
        let filing = null;
        const fRaw = pick(r, 'Annual Return Filing Month', 'Filing Month', 'Annual Return Month');
        if (fRaw) { try { filing = month(fRaw); } catch { result.problems.push(`${at} ${name}: filing month "${fRaw}" not read`); } }
        if (jur === 'NZ' && ['company', 'public-company'].includes(kind) && !filing) {
          filing = inc ? Number(inc.slice(5, 7)) : 3;
          result.problems.push(`${at} ${name}: no filing month in the export, set to ${MONTHS[filing - 1]}; check it on the Companies Register`);
        }
        if (jur === 'AU' && ['company', 'public-company'].includes(kind) && !inc) { result.problems.push(`${at} ${name}: an Australian company needs its registration date for the annual review, skipped`); continue; }
        await db.query(`insert into cosec.entities (name, jurisdiction, kind, company_number, status, incorporated_on, balance_month, filing_month, registered_office, group_name, responsible)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [name, jur, kind, pick(r, 'Company Number', 'Registration Number', 'Entity Number', 'ACN', 'NZBN') || null, status, inc, bal, filing,
          pick(r, 'Registered Office', 'Registered Office Address', 'Main Address') || null, pick(r, 'Group', 'Client', 'Entity Group', 'Client Group') || null, pick(r, 'Responsible', 'Responsible Person', 'Manager') || null]);
        result.entities_created.push(name);
      }
    }
    const ourNames = new Set((await db.query('select lower(name) as n from cosec.entities')).map((x) => x.n));
    const party = async (name, extra = {}) => {
      const hit = (await db.query('select * from cosec.parties where lower(name) = lower($1)', [name]))[0];
      if (hit) return hit;
      const kind = holderKind(name, ourNames);
      const entityId = kind !== 'individual' ? (await db.query('select id from cosec.entities where lower(name) = lower($1)', [name]))[0]?.id || null : null;
      const row = (await db.query(`insert into cosec.parties (name, kind, entity_id, lives_in, director_id, address) values ($1, $2, $3, $4, $5, $6) returning *`,
        [name, kind, entityId, extra.lives_in || null, extra.director_id || null, extra.address || null]))[0];
      result.people_created.push(name);
      return row;
    };
    const entityByName = async (name) => (await db.query('select * from cosec.entities where lower(name) = lower($1)', [name]))[0];

    if (opt(o, 'appointments')) {
      const rows = readCsv(o.appointments, mapping);
      for (const [i, r] of rows.entries()) {
        const at = `appointments row ${i + 2}`;
        const entName = pick(r, 'Appointed Entity', 'Company Name', 'Company', 'Entity');
        const person = pick(r, 'Full Name', 'Name', 'Individual', 'Officer Name', 'Officer');
        const e = entName && await entityByName(entName);
        if (!e) { result.problems.push(`${at}: entity "${entName}" is not in the system, import the entities file first`); continue; }
        if (!person) { result.problems.push(`${at}: no person`); continue; }
        const asRaw = pick(r, 'Appointed As', 'Position', 'Role', 'Appointment Type').toLowerCase();
        const role = /alternate/.test(asRaw) ? 'alternate-director' : /secretary/.test(asRaw) ? 'secretary' : /director/.test(asRaw) ? 'director' : null;
        if (!role) { result.problems.push(`${at} ${person}: role "${asRaw}" is not director, alternate or secretary, skipped`); continue; }
        let appointed;
        let ceased = null;
        try {
          appointed = anyDate(pick(r, 'Date of Appointment', 'Appointment Date', 'Date Appointed', 'Appointed'), order);
          ceased = anyDate(pick(r, 'Date of Cessation', 'Cessation Date', 'Date Ceased', 'Resignation Date', 'Ceased'), order);
        } catch (err) { result.problems.push(`${at} ${person}: ${err.message}`); continue; }
        if (!appointed) { result.problems.push(`${at} ${person}: no appointment date, skipped`); continue; }
        const livesRaw = pick(r, 'Country of Residence', 'Residential Country', 'Residence');
        let did = pick(r, 'Director Identification Number', 'Director ID', 'Director Id').replace(/\s/g, '') || null;
        if (did && !/^\d{15}$/.test(did)) { result.problems.push(`${at} ${person}: director ID "${did}" is not 15 digits, left blank`); did = null; }
        const p = await party(person, { lives_in: COUNTRY[livesRaw.toLowerCase()] || (/^[A-Z]{2}$/.test(livesRaw) ? livesRaw : null), director_id: did, address: pick(r, 'Residential Address', 'Address') || null });
        if (p.kind !== 'individual') { result.problems.push(`${at} ${person}: looks like a company or trust, only individuals hold office`); continue; }
        if (did && !p.director_id) await db.query('update cosec.parties set director_id = $1 where id = $2', [did, p.id]);
        const exists = await db.query('select 1 from cosec.officeholders where entity_id = $1 and party_id = $2 and role = $3 and appointed_on = $4', [e.id, p.id, role, appointed]);
        if (exists.length) { result.appointments_existing++; continue; }
        // History from Diligent was already lodged with the registry: mark it notified on the day.
        await db.query(`insert into cosec.officeholders (entity_id, party_id, role, appointed_on, consent_on, appointment_notified_on, ceased_on, ceased_notified_on)
          values ($1, $2, $3, $4, $5, $4, $6, $6)`, [e.id, p.id, role, appointed, e.jurisdiction === 'NZ' && role === 'director' ? appointed : null, ceased]);
        result.appointments_created++;
      }
      const missingResidence = (await db.query(`select name from cosec.parties where kind = 'individual' and lives_in is null and name = any($1::text[]) order by name`, [result.people_created])).map((x) => x.name);
      if (missingResidence.length) result.problems.push(`no country of residence for ${missingResidence.join(', ')}: the resident director checks need it (update-person --lives-in)`);
    }

    if (opt(o, 'shareholders')) {
      const rows = readCsv(o.shareholders, mapping);
      const touched = new Set();
      const already = new Set((await db.query('select distinct entity_id from cosec.share_movements')).map((x) => x.entity_id));
      for (const [i, r] of rows.entries()) {
        const at = `shareholders row ${i + 2}`;
        const entName = pick(r, 'Company Name', 'Company', 'Entity', 'Entity Name');
        const e = entName && await entityByName(entName);
        if (!e) { result.problems.push(`${at}: entity "${entName}" is not in the system, import the entities file first`); continue; }
        if (already.has(e.id) && !touched.has(e.id)) { result.holdings_skipped++; continue; }
        const holder = pick(r, 'Shareholder', 'Shareholder Name', 'Member', 'Holder', 'Name');
        if (!holder) { result.problems.push(`${at}: no shareholder`); continue; }
        let qty;
        try { qty = whole(pick(r, 'Number of Shares', 'Shares', 'Shares Held', 'Number'), 'number of shares'); } catch (err) { result.problems.push(`${at} ${holder}: ${err.message}`); continue; }
        let on;
        try { on = anyDate(pick(r, 'Date Acquired', 'Date of Issue', 'Issue Date', 'Date'), order) || e.incorporated_on || today(); } catch (err) { result.problems.push(`${at} ${holder}: ${err.message}`); continue; }
        const p = await party(holder);
        await db.query(`insert into cosec.share_movements (entity_id, kind, share_class, quantity, to_party_id, on_date, notified_on, reference)
          values ($1, 'issue', $2, $3, $4, $5, $5, 'Opening balance from Diligent Entities')`,
        [e.id, (pick(r, 'Share Class', 'Class', 'Class of Shares') || 'ORD').toUpperCase(), qty, p.id, on]);
        touched.add(e.id);
        result.holdings_created++;
      }
    }
    await db.query('insert into cosec.activity_log (actor, action, detail) values ($1, $2, $3)',
      [actor, 'import diligent', `${result.entities_created.length} entities, ${result.appointments_created} appointments, ${result.holdings_created} holdings${dry ? ' (dry run)' : ''}`]);
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return result;
}

async function exportAll(db, o) {
  const out = path.resolve(opt(o, 'out') || path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'exports', `entities-${today()}.json`));
  const data = {};
  for (const t of ['entities', 'parties', 'officeholders', 'share_movements', 'filings', 'meetings', 'holidays', 'activity_log']) data[t] = await db.query(`select * from cosec.${t}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  return { file: out, tables: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
}

// ---------------------------------------------------------------- help

export const HELP = {
  entities: 'List every entity: country, number, client group, who looks after it, directors and open items.',
  entity: 'Show one entity on one page: details, officers, share register, the yearly cycle and what is open.',
  person: 'Show every company a person or trust is a director, secretary or shareholder of, including through other companies.',
  officers: 'List the current directors and secretaries of every entity.',
  people: 'List every person, company and trust on file with their offices and holdings.',
  register: 'Show the share register of one entity: each holder, class, shares and percentage.',
  movements: 'List share issues, transfers, buy-backs and cancellations, newest first.',
  filings: 'List what was filed with the Companies Office or ASIC, newest first.',
  meetings: 'List meetings and resolutions, with when the minutes were recorded.',
  notices: 'List every change the Companies Office or ASIC has not been told about, with its legal deadline.',
  'annual-cycle': 'Show the yearly cycle for every company: NZ annual returns and annual meetings, AU review fees, statement checks and solvency resolutions.',
  calendar: 'List every deadline in the next N days (default 60), nearest first.',
  compliance: 'Check the records against the rules in docs/compliance.md and list what is late or due, with the rule.',
  attention: 'List what needs a person: late notices, missed filings, missing director IDs and consents, minutes not recorded, and what is due soon.',
  'director-ids': 'List every director of an Australian company and whether a director ID is on file.',
  groups: 'Rank client groups by what is late and what is due.',
  workload: 'Show each staff member\'s late and due items for the next N days (default 30).',
  structure: 'Draw a client group\'s ownership chart as text: who holds what, down the chain.',
  'who-controls': 'Look through every company in the chain to the people and trusts who ultimately own an entity.',
  holidays: 'List the holidays the working-day count skips.',
  history: 'Show the last 50 changes and who made them.',
  'weekly-review': 'Write the Monday review: what needs a person, unnotified changes, the next 30 days, client groups and staff.',
  'add-entity': 'Add a company, trust or partnership with its country, number, balance and filing months, group and staff member.',
  'update-entity': 'Change an entity: name, number, status, months, registered office, group, staff member, or that it lodges financial reports.',
  'add-person': 'Add a person, outside company or trust, with where they live and their director ID.',
  'update-person': 'Change a person\'s residence, director ID, address or email.',
  appoint: 'Appoint a director or secretary and show the date the registry must hear by.',
  cease: 'Record a director or secretary leaving and show the date the registry must hear by.',
  'issue-shares': 'Issue shares to a holder and show the notice deadline.',
  'transfer-shares': 'Transfer shares between holders and show the notice deadline where one applies.',
  'cancel-shares': 'Record a buy-back or cancellation of shares.',
  'mark-notified': 'Record that a change was filed with the Companies Office or ASIC.',
  file: 'Record a filing: annual return, ASIC review fee paid, annual statement checked, address or name change.',
  'record-meeting': 'Record a board or shareholders\' meeting, annual meeting, written resolution or solvency resolution.',
  'record-minutes': 'Record the day a meeting\'s minutes went into the minute book.',
  'add-holiday': 'Add a holiday the working-day count skips (next year\'s dates, or a new one).',
  'draft-reminder': 'Draft the client email for one group: what is due and what we need from them.',
  'draft-consent': 'Draft a New Zealand director\'s consent and certificate (s 152) for signing.',
  'draft-solvency': 'Draft an Australian directors\' solvency resolution (s 347A) for signing.',
  'draft-annual-resolution': 'Draft a New Zealand shareholders\' written resolution in lieu of the annual meeting (s 122).',
  import: 'Bring entities, appointments and shareholdings across from Diligent Entities Quick Report exports.',
  export: 'Write every record to one JSON file the business owns.',
};

// ---------------------------------------------------------------- dispatch

export async function execute(db, cmd, o = {}) {
  if (reads[cmd]) return db.query(reads[cmd]);
  switch (cmd) {
    case 'help': return Object.entries(HELP).map(([command, does]) => ({ command, does }));
    case 'entity': return entityCard(db, o);
    case 'person': return personCard(db, o);
    case 'register': return register(db, o);
    case 'movements': return movements(db, o);
    case 'filings': return filings(db, o);
    case 'meetings': return meetings(db, o);
    case 'calendar': return calendar(db, o);
    case 'workload': return workload(db, o);
    case 'structure': return structure(db, o);
    case 'who-controls': return whoControls(db, o);
    case 'weekly-review': return weeklyReview(db);
    case 'add-entity': return addEntity(db, o);
    case 'update-entity': return updateEntity(db, o);
    case 'add-person': return addPerson(db, o);
    case 'update-person': return updatePerson(db, o);
    case 'appoint': return appoint(db, o);
    case 'cease': return cease(db, o);
    case 'issue-shares': return movement(db, o, 'issue');
    case 'transfer-shares': return movement(db, o, 'transfer');
    case 'cancel-shares': return movement(db, o, 'cancel');
    case 'mark-notified': return markNotified(db, o);
    case 'file': return file(db, o);
    case 'record-meeting': return recordMeeting(db, o);
    case 'record-minutes': return recordMinutes(db, o);
    case 'add-holiday': return addHoliday(db, o);
    case 'draft-reminder': return draftReminder(db, o);
    case 'draft-consent': return draftConsent(db, o);
    case 'draft-solvency': return draftSolvency(db, o);
    case 'draft-annual-resolution': return draftAnnualResolution(db, o);
    case 'import': return importDiligent(db, o);
    case 'export': return exportAll(db, o);
    default: throw Error(`Unknown command ${cmd}`);
  }
}

// ---------------------------------------------------------------- human output

function plain(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return /^-?\d+\.\d+$/.test(s) ? s.replace(/\.?0+$/, '') : s;
}

const money = (v, country) => `${country === 'AU' ? 'A$' : '$'}${(Number(v) / 100).toLocaleString('en-NZ', { maximumFractionDigits: 2 })}`;

export function columns(rows) {
  return Object.keys(rows[0]).filter((k) => !['currency_country'].includes(k)).map((k) => ({
    key: k,
    label: k.replace(/_cents$/, '').replace(/_pct$/, ' %').replace(/^pct_of_class$/, '% of class').replace(/_/g, ' '),
    align: /_cents$|_pct$|^pct_|^shares$|^quantity$|^days|^directors$|^open_items$|^entities$|^australian$|^breached$|^due_soon$|^late$|^due$|^offices$|^holdings$/.test(k) ? 'right' : 'left',
    format: k.endsWith('_cents') ? (v, r) => (v === null || v === undefined ? '' : money(v, r.currency_country))
      : k === 'id' ? (v) => String(v).slice(0, 8)
        : (k === 'shares' || k === 'quantity') ? (v) => Number(v).toLocaleString('en-NZ')
          : (v) => plain(v),
    width: 90,
  }));
}

export function render(cmd, result) {
  if (Array.isArray(result)) return result.length ? table(result, columns(result)) : '  (none)';
  if (cmd === 'structure') return `${result.group}\n\n${result.lines.map((l) => `  ${l}`).join('\n')}`;
  if (cmd === 'weekly-review') return Object.entries(result).map(([k, rows]) => `${heading(k)}\n${render('', rows)}`).join('\n');
  if (cmd === 'import') {
    const r = result;
    return [`  ${r.dry_run ? 'DRY RUN, nothing saved. ' : ''}${r.entities_created.length} entities created, ${r.entities_existing} already here`,
      `  ${r.people_created.length} people, companies and trusts created`,
      `  ${r.appointments_created} appointments created, ${r.appointments_existing} already here`,
      `  ${r.holdings_created} opening holdings created, ${r.holdings_skipped} skipped (the entity already has a register)`,
      ...(r.problems.length ? ['  problems:', ...r.problems.map((p) => `    ${p}`)] : ['  problems: none'])].join('\n');
  }
  // A card: scalar lines first, then each list as a table.
  const scalars = Object.entries(result).filter(([, v]) => !Array.isArray(v));
  const lists = Object.entries(result).filter(([, v]) => Array.isArray(v));
  return [
    scalars.map(([k, v]) => `  ${k.replace(/_/g, ' ')}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : plain(v)}`).join('\n'),
    ...lists.map(([k, rows]) => `\n  ${k.replace(/_/g, ' ')}\n${rows.length && typeof rows[0] === 'object' ? render('', rows) : rows.length ? rows.map((x) => `  ${x}`).join('\n') : '  (none)'}`),
  ].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let db;
  try {
    const { cmd, o } = parse(process.argv.slice(2));
    db = await getDb();
    const result = await execute(db, cmd, o);
    console.log(o.json ? JSON.stringify(result, null, 2) : render(cmd, result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
