import Database from 'better-sqlite3';
import path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { nodeSqliteDriver, d1Driver, tryGetD1, type DbDriver } from '@/lib/db-driver';
import type { BankSummary } from '@/lib/bank-statements';

/**
 * Bank statement-summary store — a SEPARATE store from the shared FounderDb
 * (local: data/bank.db, gitignored PII; deployed: the bank_summaries table in
 * the same D1 database), keyed by (account, month) so re-uploading a
 * statement updates in place. Holds per-business monthly income/outflow, not
 * transactions.
 */

const DEFAULT_PATH = process.env.BANK_DB ?? path.join(process.cwd(), 'data', 'bank.db');

export type BankStore = {
  upsert(summary: BankSummary): Promise<void>;
  all(): Promise<BankSummary[]>;
  close(): void;
};

const UPSERT_SQL = `INSERT INTO bank_summaries (account, business, month, credits_cents, debits_cents, net_cents)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(account, month) DO UPDATE SET
    business = excluded.business,
    credits_cents = excluded.credits_cents,
    debits_cents = excluded.debits_cents,
    net_cents = excluded.net_cents`;

const ALL_SQL = `SELECT account, business, month, credits_cents AS creditsCents, debits_cents AS debitsCents, net_cents AS netCents
  FROM bank_summaries ORDER BY month ASC, business ASC`;

function buildBankStore(driver: DbDriver, close: () => void): BankStore {
  return {
    async upsert(summary) {
      await driver
        .prepare(UPSERT_SQL)
        .run(summary.account, summary.business, summary.month, summary.creditsCents, summary.debitsCents, summary.netCents);
    },
    async all() {
      return (await driver.prepare(ALL_SQL).all()) as BankSummary[];
    },
    close,
  };
}

/** Local/Railway path: a real better-sqlite3 file (or `:memory:` in tests). */
export function openBankStore(file: string = DEFAULT_PATH): BankStore {
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.exec(`CREATE TABLE IF NOT EXISTS bank_summaries (
    account TEXT NOT NULL,
    business TEXT NOT NULL,
    month TEXT NOT NULL,
    credits_cents INTEGER NOT NULL,
    debits_cents INTEGER NOT NULL,
    net_cents INTEGER NOT NULL,
    PRIMARY KEY (account, month)
  )`);
  return buildBankStore(nodeSqliteDriver(raw), () => raw.close());
}

/** Cloudflare Workers path: the shared D1 binding (see migrations/). */
export function openD1BankStore(d1: D1Database): BankStore {
  return buildBankStore(d1Driver(d1), () => {});
}

/** Picks the right backend the same way lib/data.ts's getDb() does. */
export async function getBankStore(): Promise<BankStore> {
  const d1 = await tryGetD1();
  return d1 ? openD1BankStore(d1) : openBankStore();
}
