import Database from 'better-sqlite3';
import path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { d1Driver, tryGetD1 } from '@/lib/db-driver';
import type { LedgerRow } from '@/lib/statements';

/**
 * Statement ledger — a SEPARATE store from the shared FounderDb (local:
 * data/ledger.db, gitignored PII; deployed: the ledger_rows table in the
 * same D1 database) so uploaded bank/CC data never touches the shared app
 * DB / schema / seed. Deliberately NOT wired into lib/db.ts's repo layer.
 */

const DEFAULT_PATH = process.env.LEDGER_DB ?? path.join(process.cwd(), 'data', 'ledger.db');

const DDL = `CREATE TABLE IF NOT EXISTS ledger_rows (
  hash TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  direction TEXT NOT NULL,
  category TEXT NOT NULL
)`;

const INSERT_SQL = `INSERT OR IGNORE INTO ledger_rows (hash, date, description, amount_cents, direction, category)
  VALUES (?, ?, ?, ?, ?, ?)`;
const LATEST_MONTH_SQL = `SELECT MAX(substr(date, 1, 7)) AS m FROM ledger_rows WHERE direction = 'out'`;
const MONTHLY_SQL = `SELECT category, SUM(amount_cents) AS cents FROM ledger_rows
  WHERE direction = 'out' AND substr(date, 1, 7) = ? GROUP BY category ORDER BY cents DESC`;
const RECONCILE_SQL = `SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM ledger_rows
  WHERE direction = 'out' AND (? IS NULL OR substr(date, 1, 7) = ?)`;
const ROW_COUNT_SQL = `SELECT COUNT(*) AS n FROM ledger_rows`;

const rowHash = (r: LedgerRow) => `${r.date}|${r.description}|${r.amountCents}|${r.direction}`;

export type Ledger = {
  insertRows(rows: LedgerRow[]): Promise<number>;
  /** Spend by category for the most recent month present (so "/mo" is honest). */
  monthly(): Promise<{ category: string; total: number }[]>;
  /** The latest YYYY-MM with spend, or null when empty. */
  latestMonth(): Promise<string | null>;
  reconcile(incomeUsd: number): Promise<{ income: number; expenses: number; net: number }>;
  rowCount(): Promise<number>;
  close(): void;
};

/** Local/Railway path: a real better-sqlite3 file (or `:memory:` in tests). */
export function openLedger(file: string = DEFAULT_PATH): Ledger {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(DDL);

  const insert = db.prepare(INSERT_SQL);
  const latestMonthStmt = db.prepare(LATEST_MONTH_SQL);
  const monthlyStmt = db.prepare(MONTHLY_SQL);
  const reconcileStmt = db.prepare(RECONCILE_SQL);
  const rowCountStmt = db.prepare(ROW_COUNT_SQL);

  const latestMonthOf = (): string | null => {
    const r = latestMonthStmt.get() as { m: string | null };
    return r.m ?? null;
  };

  return {
    async insertRows(rows) {
      let inserted = 0;
      const tx = db.transaction((rs: LedgerRow[]) => {
        for (const r of rs) inserted += insert.run(rowHash(r), r.date, r.description, r.amountCents, r.direction, r.category).changes;
      });
      tx(rows);
      return inserted;
    },
    async latestMonth() {
      return latestMonthOf();
    },
    async monthly() {
      const m = latestMonthOf();
      if (!m) return [];
      const rows = monthlyStmt.all(m) as { category: string; cents: number }[];
      return rows.map((r) => ({ category: r.category, total: r.cents / 100 }));
    },
    async reconcile(incomeUsd) {
      const m = latestMonthOf();
      const r = reconcileStmt.get(m, m) as { cents: number };
      const expenses = r.cents / 100;
      return { income: incomeUsd, expenses, net: incomeUsd - expenses };
    },
    async rowCount() {
      return (rowCountStmt.get() as { n: number }).n;
    },
    close() {
      db.close();
    },
  };
}

/** Cloudflare Workers path: the shared D1 binding (see migrations/). Rows are
 *  independent (deduped by content hash), so each insert runs concurrently
 *  rather than via better-sqlite3's synchronous transaction() — D1 has no
 *  equivalent callback-transaction API. */
export function openD1Ledger(d1: D1Database): Ledger {
  const driver = d1Driver(d1);
  const latestMonthOf = async (): Promise<string | null> => {
    const r = (await driver.prepare(LATEST_MONTH_SQL).get()) as { m: string | null } | undefined;
    return r?.m ?? null;
  };

  return {
    async insertRows(rows) {
      const results = await Promise.all(
        rows.map((r) =>
          driver.prepare(INSERT_SQL).run(rowHash(r), r.date, r.description, r.amountCents, r.direction, r.category),
        ),
      );
      return results.reduce((sum, r) => sum + r.changes, 0);
    },
    latestMonth: latestMonthOf,
    async monthly() {
      const m = await latestMonthOf();
      if (!m) return [];
      const rows = (await driver.prepare(MONTHLY_SQL).all(m)) as { category: string; cents: number }[];
      return rows.map((r) => ({ category: r.category, total: r.cents / 100 }));
    },
    async reconcile(incomeUsd) {
      const m = await latestMonthOf();
      const r = (await driver.prepare(RECONCILE_SQL).get(m, m)) as { cents: number };
      const expenses = r.cents / 100;
      return { income: incomeUsd, expenses, net: incomeUsd - expenses };
    },
    async rowCount() {
      return ((await driver.prepare(ROW_COUNT_SQL).get()) as { n: number }).n;
    },
    close() {},
  };
}

/** Picks the right backend the same way lib/data.ts's getDb() does. */
export async function getLedger(): Promise<Ledger> {
  const d1 = await tryGetD1();
  return d1 ? openD1Ledger(d1) : openLedger();
}
