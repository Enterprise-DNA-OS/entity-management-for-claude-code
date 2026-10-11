#!/usr/bin/env node
// Loads the demo practice: Tōtara Chartered Accountants and its five client groups. Dates are set
// relative to the day you first seed, so there is always something late and something due. Safe to run more than once.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  await db.exec('BEGIN');
  try {
    await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const db = await getDb();
  try {
    await seed(db);
    console.log('seed: Tōtara Chartered Accountants demo ready (11 entities, 5 client groups, New Zealand and Australia)');
  } finally {
    await db.close();
  }
}
