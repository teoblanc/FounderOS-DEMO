import path from 'node:path';
import fs from 'node:fs';
import { openDb, openD1Db, type FounderDb } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { tryGetD1 } from '@/lib/db-driver';

/**
 * App-level singleton. Larp-first, real-ready: every page and API route reads
 * through this seeded database, so swapping in live sources later is a
 * repo-level change, not a UI rewrite.
 *
 * Backend picks itself at runtime: a Cloudflare D1 binding (only resolvable
 * under the OpenNext/Workers build) means we're deployed to a Worker, so use
 * D1; anything else — `next dev`, `next start` (Railway), tests — keeps using
 * the local better-sqlite3 file, unchanged.
 */
let instancePromise: Promise<FounderDb> | null = null;

function openNodeDb(): FounderDb {
  const dbPath = process.env.FOUNDER_OS_DB ?? path.join(process.cwd(), 'data', 'founder-os.db');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return openDb(dbPath);
}

async function initDb(): Promise<FounderDb> {
  const d1 = await tryGetD1();
  const db = d1 ? openD1Db(d1) : openNodeDb();
  // Seed on first touch so a fresh clone (or a freshly migrated D1 database)
  // boots looking alive. Each clause back-fills databases/tables created
  // before that data existed; seedDatabase is idempotent (INSERT OR REPLACE),
  // so re-running only adds what's missing.
  const empty =
    (await db.departments.all()).length === 0 ||
    (await db.workflows.all()).length === 0 ||
    (await db.skills.all()).length === 0 ||
    (await db.social.accounts()).length === 0 ||
    (await db.emailList.snapshots()).length === 0 ||
    (await db.social.dmSnapshots()).length === 0 ||
    (await db.social.dmMessages()).length === 0 ||
    (await db.leadMagnets.all()).length === 0;
  if (empty) await seedDatabase(db);
  return db;
}

export function getDb(): Promise<FounderDb> {
  if (!instancePromise) instancePromise = initDb();
  return instancePromise;
}
