import { afterEach, describe, expect, it } from 'vitest';
import { openBankStore, type BankStore } from '@/lib/bank';
import type { BankSummary } from '@/lib/bank-statements';

let store: BankStore;
afterEach(() => store?.close());

const s = (account: string, business: string, month: string, c: number, d: number): BankSummary => ({
  account,
  business,
  month,
  creditsCents: c,
  debitsCents: d,
  netCents: c - d,
});

describe('bank store', () => {
  it('stores summaries and returns them ordered by month', async () => {
    store = openBankStore(':memory:');
    await store.upsert(s('7001', 'General Operations', '2026-04', 2130040, 1785015));
    await store.upsert(s('7002', 'Vantage', '2026-04', 4000000, 1200000));
    await store.upsert(s('7001', 'General Operations', '2026-03', 1800000, 1500000));
    expect(await store.all()).toHaveLength(3);
    expect((await store.all()).map((x) => x.month)[0]).toBe('2026-03');
  });

  it('re-uploading the same account+month updates rather than duplicates', async () => {
    store = openBankStore(':memory:');
    await store.upsert(s('7001', 'General Operations', '2026-04', 1000, 500));
    await store.upsert(s('7001', 'General Operations', '2026-04', 2130040, 1785015));
    expect(await store.all()).toHaveLength(1);
    expect((await store.all())[0].creditsCents).toBe(2130040);
    expect((await store.all())[0].netCents).toBe(2130040 - 1785015);
  });
});
