#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, then exercise every command and the
// rules that matter (working-day deadlines, notices, the yearly cycle, resident directors,
// director IDs, consents, minutes, the share register, look-through ownership, import).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, parse, specs, reads, render, anyDate, HELP } from './entities.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'entities-test-'));
process.env.DATA_DIR = path.join(tmp, 'db');
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const env = { ...process.env };
const actor = 'Test operator';
const exercised = new Set();
let db;
const run = async (cmd, o = {}) => { exercised.add(cmd); return execute(db, cmd, o); };
const cli = (args) => spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'entities.mjs'), ...args], { cwd: REPO_ROOT, env, encoding: 'utf8' });
const fixture = (f) => path.join(REPO_ROOT, 'fixtures', f);
const findings = async (rule) => (await run('compliance')).filter((f) => f.rule === rule);
const wd = async (d, n) => (await db.query("select cosec.add_working_days($1::date, $2, 'NZ')::text as d", [d, n]))[0].d;

try {
  db = await getDb();
  if (db.mode === 'postgres') await db.exec('drop schema if exists cosec cascade; drop table if exists schema_migrations;');
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0, 'migrate is repeatable');
  await seed(db);
  const counts = async () => (await db.query('select (select count(*) from cosec.entities)::int as e, (select count(*) from cosec.officeholders)::int as o, (select count(*) from cosec.share_movements)::int as m, (select count(*) from cosec.filings)::int as f, (select count(*) from cosec.meetings)::int as g'))[0];
  const before = await counts();
  await seed(db);
  assert.deepEqual(await counts(), before, 'seed is idempotent');
  assert.equal(before.e, 11);
  for (const cmd of Object.keys(reads)) assert(Array.isArray(await run(cmd)), `${cmd} returns rows`);

  // Working days, New Zealand: weekends, national holidays and 25 December to 2 January do not count.
  assert.equal(await wd('2026-09-07', 20), '2026-10-05');
  assert.equal(await wd('2026-10-23', 1), '2026-10-27', 'Labour Day 2026 is skipped');
  assert.equal(await wd('2026-12-20', 10), '2027-01-12', 'the summer closure and the observed holiday are skipped');
  await run('add-holiday', { date: '2028-02-07', country: 'NZ', name: 'Waitangi Day (observed)', actor });
  assert.equal(await wd('2028-02-04', 1), '2028-02-08');

  // The demo's planted problems all show up, with the right rule.
  const attention = await run('attention');
  const has = (rule, entity) => attention.some((a) => a.rule === rule && a.entity === entity);
  assert(has('NZ-DIRECTOR-NOTICE', 'Rimu Freight Limited'));
  assert(has('AU-OFFICEHOLDER-NOTICE', 'Rimu Freight Australia Pty Ltd'));
  assert(has('NZ-SHARE-ISSUE-NOTICE', 'Rimu Freight Limited'));
  assert(has('AU-SHARE-NOTICE', 'Matai Investments Pty Ltd'));
  assert(has('NZ-ANNUAL-RETURN', 'Kauri Orchards Limited'));
  assert(has('NZ-ANNUAL-MEETING', 'Pohutukawa Dental Limited'));
  assert(has('AU-REVIEW-FEE', 'Kauri Trading Pty Ltd'));
  assert(has('AU-SOLVENCY', 'Kauri Trading Pty Ltd'));
  assert(has('AU-RESIDENT-DIRECTOR', 'Kauri Trading Pty Ltd'));
  assert(has('AU-DIRECTOR-ID', 'Kauri Trading Pty Ltd'));
  assert(has('NZ-DIRECTOR-CONSENT', 'Pohutukawa Dental Limited'));
  assert(has('AU-MINUTES', 'Rimu Freight Australia Pty Ltd'));
  assert(!attention.some((a) => a.entity.startsWith('Harbour')), 'the Liu family companies are clean');
  assert(!attention.some((a) => a.entity === 'Old Totara Ventures Limited'), 'a removed company has no deadlines');
  // An Australian-resident director who directs an Australian company satisfies NZ s 10(d).
  assert.equal((await findings('NZ-RESIDENT-DIRECTOR')).length, 0);

  const nzNotice = (await run('notices')).find((n) => n.entity === 'Rimu Freight Limited' && n.change === 'appointment');
  const hemi = (await db.query("select appointed_on from cosec.officeholders o join cosec.parties p on p.id = o.party_id where p.name = 'Hemi Rawiri'"))[0];
  assert.equal(nzNotice.due_on, await wd(hemi.appointed_on, 20), 'NZ director notice is 20 working days');
  const auNotice = (await run('notices')).find((n) => n.change === 'cessation');
  assert.equal((new Date(auNotice.due_on) - new Date(auNotice.happened_on)) / 86400000, 28, 'AU officeholder notice is 28 days');

  // Reports.
  const card = await run('entity', { entity: 'Kauri Trading' });
  assert.equal(card.officers.length, 2);
  assert.equal(card.register[0].holder, 'Kauri Holdings Limited');
  assert(card.open_items.length >= 3);
  const grace = await run('person', { person: 'grace liu' });
  assert.equal(grace.offices.length, 3);
  assert.deepEqual(grace.owns_through_companies.map((x) => [x.entity, x.effective_pct]).sort(), [['Harbour Developments Pty Ltd', 35], ['Harbour Property Limited', 35]]);
  const control = await run('who-controls', { entity: 'Harbour Developments' });
  assert.deepEqual(control.map((c) => [c.ultimate_holder, c.effective_pct]), [['Grace Liu', 35], ['Liu Family Trust', 35], ['David Chen', 30]]);
  assert.equal(control.reduce((s, c) => s + c.effective_pct, 0), 100);
  const tree = await run('structure', { group: 'Liu' });
  assert(tree.lines.some((l) => l.includes('David Chen 30%')));
  assert(tree.lines.some((l) => l.includes('100% > Harbour Developments Pty Ltd')));
  assert.equal((await run('register', { entity: 'Rimu Freight Limited' })).length, 2);
  assert((await run('movements', { entity: 'Matai' })).some((m) => m.kind === 'transfer'));
  assert((await run('filings')).length >= 5);
  assert((await run('meetings', { entity: 'Rimu Freight Australia' })).length === 2);
  assert((await run('calendar', { days: '90' })).length >= 8);
  const load = await run('workload', { days: '30' });
  assert.deepEqual(load.map((w) => w.responsible).sort(), ['Aroha Ngata', 'Ben Walsh']);
  const review = await run('weekly-review');
  assert.equal(Object.keys(review).length, 5);
  assert((await run('groups'))[0].breached >= 2);
  assert.equal((await run('director-ids')).find((d) => d.person === 'Tom Kauri').director_id, 'MISSING');
  assert.equal((await run('help')).length, Object.keys(HELP).length);

  // Ambiguous and unknown names stop with the candidates.
  await assert.rejects(run('entity', { entity: 'rimu' }), /More than one entity matches "rimu"[\s\S]*Rimu Freight Limited/);
  await assert.rejects(run('person', { person: 'nobody at all' }), /No person matches/);

  // Writes, and the findings they clear.
  await run('file', { entity: 'Kauri Orchards', kind: 'annual-return', reference: 'AR-5730114', actor });
  assert(!(await findings('NZ-ANNUAL-RETURN')).some((f) => f.entity === 'Kauri Orchards Limited'));
  await assert.rejects(run('file', { entity: 'Kauri Trading', kind: 'annual-return', actor }), /Annual returns are for New Zealand/);
  await run('file', { entity: 'Kauri Trading', kind: 'annual-review-fee', reference: 'BPAY 77', actor });
  assert(!(await findings('AU-REVIEW-FEE')).some((f) => f.entity === 'Kauri Trading Pty Ltd'));
  await run('record-meeting', { entity: 'Kauri Trading', kind: 'solvency-resolution', actor });
  assert(!(await findings('AU-SOLVENCY')).some((f) => f.entity === 'Kauri Trading Pty Ltd'));
  const neg = await run('record-meeting', { entity: 'Matai', kind: 'solvency-resolution', outcome: 'negative', actor });
  assert(neg.warnings[0].includes('7 days'));
  await assert.rejects(run('record-meeting', { entity: 'Kauri Orchards', kind: 'solvency-resolution', actor }), /Australian companies/);
  await run('record-meeting', { entity: 'Pohutukawa', kind: 'annual-resolution', actor });
  assert.equal((await findings('NZ-ANNUAL-MEETING')).length, 0);

  // Minutes: recorded late, the finding says so; recorded in time, it clears.
  const mins = await run('meetings', { entity: 'Rimu Freight Australia' });
  await run('record-minutes', { meeting: String(mins.find((m) => m.title.includes('depot')).id).slice(0, 8), actor });
  assert((await findings('AU-MINUTES')).some((f) => f.item.includes('depot') && f.finding.includes('more than a month after')));
  await run('record-minutes', { meeting: String(mins.find((m) => m.title.includes('resignation')).id).slice(0, 8), actor });
  assert(!(await findings('AU-MINUTES')).some((f) => f.item.includes('resignation')));

  // Notices: mark them filed; a late one reports how late.
  const late = await run('mark-notified', { id: String(nzNotice.id).slice(0, 8), actor });
  assert(late.late_by_days > 0);
  assert(!(await run('notices')).some((n) => n.detail.includes('Hemi Rawiri appointed')));
  assert((await findings('NZ-DIRECTOR-NOTICE')).some((f) => f.severity === 'late'), 'a late notice stays visible as late');
  await assert.rejects(run('mark-notified', { id: String(nzNotice.id).slice(0, 8), actor }), /No open notice/);

  // Officeholders: resident director, director ID, consent.
  const jack = await run('appoint', { entity: 'Kauri Trading', person: 'Jack Morrison', date: new Date().toISOString().slice(0, 10), actor });
  assert.equal(jack.warnings.length, 0);
  assert(jack.notify_registry_by);
  assert.equal((await findings('AU-RESIDENT-DIRECTOR')).length, 0);
  await run('update-person', { person: 'Tom Kauri', 'director-id': '036000999000111', actor });
  assert.equal((await findings('AU-DIRECTOR-ID')).length, 0);
  await assert.rejects(run('update-person', { person: 'Tom Kauri', 'director-id': '123', actor }), /15 digits/);
  await run('add-person', { name: 'Aria Thompson', 'lives-in': 'nz', email: 'aria@example.com', actor });
  const aria = await run('appoint', { entity: 'Pohutukawa', person: 'Aria Thompson', actor });
  assert(aria.warnings[0].includes('s 152'));
  assert((await findings('NZ-DIRECTOR-CONSENT')).some((f) => f.item.includes('Aria Thompson')));
  await assert.rejects(run('appoint', { entity: 'Kauri Holdings', person: 'Kauri Family Trust', actor }), /Only an individual/);
  const gone = await run('cease', { entity: 'Kauri Orchards', person: 'Mere Kauri', actor });
  assert.equal(gone.directors_left, 0);
  assert((await findings('NZ-RESIDENT-DIRECTOR')).some((f) => f.entity === 'Kauri Orchards Limited'), 'a company with no directors breaches s 10(d)');
  await assert.rejects(run('cease', { entity: 'Kauri Orchards', person: 'Mere Kauri', actor }), /not a current director/);

  // The share register is the sum of its movements and cannot go below zero.
  const issued = await run('issue-shares', { entity: 'Matai', to: 'Noah Hart', quantity: '50', amount: '5000', actor });
  assert.equal(issued.register.find((r) => r.holder === 'Noah Hart').shares, 75);
  assert(issued.notify_registry_by);
  await assert.rejects(run('transfer-shares', { entity: 'Matai', from: 'Noah Hart', to: 'Olivia Hart', quantity: '76', actor }), /holder has 75/);
  const moved = await run('transfer-shares', { entity: 'Matai', from: 'Noah Hart', to: 'Olivia Hart', quantity: '25', actor });
  assert.equal(moved.register.find((r) => r.holder === 'Olivia Hart').shares, 100);
  const bought = await run('cancel-shares', { entity: 'Matai', from: 'Olivia Hart', quantity: '10', actor });
  assert.equal(bought.register.find((r) => r.holder === 'Olivia Hart').shares, 90);
  const nzTransfer = await run('transfer-shares', { entity: 'Rimu Freight Limited', from: 'Sione Taufa', to: 'Hemi Rawiri', quantity: '100', actor });
  assert.equal(nzTransfer.notify_registry_by, null, 'a New Zealand transfer goes on the next annual return, no notice');

  // Entities.
  await assert.rejects(run('add-entity', { name: 'Tui Limited', country: 'NZ', actor }), /filing-month/);
  await assert.rejects(run('add-entity', { name: 'Tui Pty Ltd', country: 'AU', actor }), /--incorporated/);
  const tui = await run('add-entity', { name: 'Tui Limited', country: 'nz', 'filing-month': 'November', 'balance-month': 'mar', number: '9000001', group: 'Kauri family', responsible: 'Aroha Ngata', incorporated: '2025-11-02', actor });
  assert.equal(tui.added, 'Tui Limited');
  await run('update-entity', { entity: 'Tui Limited', status: 'removed', actor });
  assert.equal((await run('entities')).find((e) => e.entity === 'Tui Limited').status, 'removed');

  // Drafts land in drafts/, never sent.
  for (const [cmd, o] of [['draft-reminder', { group: 'Kauri' }], ['draft-consent', { entity: 'Pohutukawa', person: 'Aria Thompson' }],
    ['draft-solvency', { entity: 'Rimu Freight Australia' }], ['draft-annual-resolution', { entity: 'Harbour Holdings' }]]) {
    const r = await run(cmd, o);
    const body = fs.readFileSync(r.draft, 'utf8');
    assert(r.draft.startsWith(path.join(tmp, 'drafts')), `${cmd} writes to drafts/`);
    assert(body.includes('Draft'), `${cmd} is marked as a draft`);
    assert(!body.includes('\u2014'), `${cmd} has no em dash`);
  }
  await assert.rejects(run('draft-solvency', { entity: 'Kauri Holdings' }), /Australian/);
  await assert.rejects(run('draft-consent', { entity: 'Kauri Trading', person: 'Tom Kauri' }), /New Zealand/);

  // Import from Diligent Entities Quick Report exports.
  const files = { entities: fixture('diligent-entities.csv'), appointments: fixture('diligent-appointments.csv'), shareholders: fixture('diligent-shareholders.csv') };
  const dry = await run('import', { ...files, 'dry-run': true, actor });
  assert.equal(dry.entities_created.length, 4);
  assert.equal((await db.query("select count(*)::int as n from cosec.entities where name like 'Takahe%'"))[0].n, 0, 'a dry run saves nothing');
  const imp = await run('import', { ...files, actor });
  assert.equal(imp.entities_created.length, 4);
  assert.equal(imp.appointments_created, 5);
  assert.equal(imp.holdings_created, 3);
  assert(imp.problems.some((p) => p.includes('United States')));
  assert(imp.problems.some((p) => p.includes('not 15 digits')));
  assert(imp.problems.some((p) => p.includes('only individuals hold office')));
  assert(imp.problems.some((p) => p.includes('"Moa Limited"')));
  const again = await run('import', { ...files, actor });
  assert.equal(again.entities_created.length + again.appointments_created + again.holdings_created, 0, 'import is repeatable');
  assert.equal(again.entities_existing, 4);
  const takahe = await run('entity', { entity: 'Takahe Engineering Pty Ltd' });
  assert.equal(takahe.register[0].holder, 'Takahe Engineering Limited');
  assert.equal(takahe.incorporated, '2021-09-03');
  assert.equal(takahe.officers.length, 3);
  const nzTakahe = await run('entity', { entity: 'Takahe Engineering Limited' });
  assert.equal(nzTakahe.filing_month, 'february');
  assert.equal(nzTakahe.officers.length, 1, 'the ceased director is history, not a current officer');
  assert.equal((await db.query("select kind from cosec.parties where name = 'Takahe Property Trust'"))[0].kind, 'trust');
  assert.equal((await run('entities')).find((e) => e.entity === 'Weka Ventures Limited').status, 'removed');
  assert.equal(anyDate('3 Sep 2021'), '2021-09-03');
  assert.equal(anyDate('04/05/2026', 'mdy'), '2026-04-05');
  assert.throws(() => anyDate('31/02/2026'), /Invalid date/);

  // Export.
  const ex = await run('export', { out: path.join(tmp, 'export.json') });
  assert(ex.tables.entities >= 15);
  assert(JSON.parse(fs.readFileSync(ex.file, 'utf8')).share_movements.length > 10);
  assert((await run('history')).length > 10);

  // Every command ran, every command has a slash command, and every slash command has a command.
  const mdDir = path.join(REPO_ROOT, '.claude', 'commands');
  const md = new Set(fs.readdirSync(mdDir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => f.replace(/\.md$/, '')));
  for (const cmd of Object.keys(specs)) {
    assert(exercised.has(cmd), `smoke exercises ${cmd}`);
    assert(md.has(cmd), `.claude/commands/${cmd}.md exists`);
    assert(HELP[cmd] || cmd === 'help', `help describes ${cmd}`);
  }
  for (const m of md) assert(specs[m] || ['customise', 'new-view'].includes(m), `${m}.md drives a real command`);

  // Rendering and parsing.
  for (const cmd of ['entity', 'structure', 'weekly-review', 'import']) assert(typeof render(cmd, cmd === 'entity' ? card : cmd === 'structure' ? tree : cmd === 'import' ? imp : review) === 'string');
  assert.deepEqual(parse(['entity', 'Kauri Trading']).o, { entity: 'Kauri Trading' });
  assert.throws(() => parse(['entity', '--bogus=1']), /Unknown --bogus/);
  assert.throws(() => parse(['import', 'persefoni']), /import diligent/);
  assert.throws(() => parse(['nope']), /Unknown command/);
} finally {
  if (db) await db.close();
}

// The CLI end to end: human output, --json, and exit 1 on an ambiguous name.
let r = cli(['attention']);
assert.equal(r.status, 0, r.stderr);
assert(r.stdout.includes('severity'));
r = cli(['who-controls', 'Harbour Developments', '--json']);
assert.equal(r.status, 0, r.stderr);
assert.equal(JSON.parse(r.stdout).length, 3);
r = cli(['entity', 'rimu']);
assert.equal(r.status, 1);
assert(r.stderr.includes('More than one entity'));
for (const script of ['view.mjs', 'docs.mjs']) {
  r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { cwd: tmp, env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${script}: ${r.stderr}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`smoke: PASS (${exercised.size} commands exercised, ${db.mode})`);
