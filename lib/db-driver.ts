import type Database from 'better-sqlite3';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Storage-engine abstraction so lib/db.ts's repo methods (the SQL + Zod
 * parsing logic) are written once and run against either backend: local
 * better-sqlite3 (dev, tests, the existing Railway/Node path) or Cloudflare
 * D1 (the Workers deployment). D1's binding API is async-only, so every
 * PreparedStatement method here is a Promise — the node driver just wraps
 * already-synchronous calls in `async` to match the same shape.
 */
export type DriverRow = Record<string, unknown>;

export interface PreparedStatement {
  all(...params: unknown[]): Promise<DriverRow[]>;
  get(...params: unknown[]): Promise<DriverRow | undefined>;
  run(...params: unknown[]): Promise<{ changes: number }>;
}

export interface DbDriver {
  prepare(sql: string): PreparedStatement;
}

export function nodeSqliteDriver(raw: InstanceType<typeof Database>): DbDriver {
  return {
    prepare(sql: string): PreparedStatement {
      const stmt = raw.prepare(sql);
      return {
        async all(...params) {
          return stmt.all(...params) as DriverRow[];
        },
        async get(...params) {
          return stmt.get(...params) as DriverRow | undefined;
        },
        async run(...params) {
          return stmt.run(...params);
        },
      };
    },
  };
}

export function d1Driver(d1: D1Database): DbDriver {
  return {
    prepare(sql: string): PreparedStatement {
      const stmt = d1.prepare(sql);
      return {
        async all(...params) {
          const { results } = await stmt.bind(...params).all();
          return results as DriverRow[];
        },
        async get(...params) {
          const row = await stmt.bind(...params).first();
          // better-sqlite3's .get() returns undefined (not null) for "no row" —
          // normalize so shared repo-method bodies behave identically either way.
          return row === null ? undefined : (row as DriverRow);
        },
        async run(...params) {
          const result = await stmt.bind(...params).run();
          return { changes: result.meta.changes };
        },
      };
    },
  };
}

/**
 * Resolves the app's D1 binding when running under the OpenNext/Workers
 * build; returns null everywhere else (`next dev`, `next start` on Railway,
 * tests) so callers fall back to their local better-sqlite3 path. Shared by
 * lib/data.ts, lib/bank.ts, and lib/ledger.ts — all three stores pick their
 * backend the same way.
 */
export async function tryGetD1(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as { DB?: D1Database };
    return env.DB ?? null;
  } catch {
    return null;
  }
}
