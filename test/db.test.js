const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LedgerDatabase } = require('../src/main/db');

test('LedgerDatabase can insert and summarize entries', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ledger-test-'));
  const dbPath = path.join(dir, 'test.sqlite');
  const db = new LedgerDatabase(dbPath);
  await db.initialize();

  await db.addEntry({
    date: '2026-03-01',
    accountItem: '旅費交通費',
    description: '出張',
    amount: 12000,
    category: '支出',
    department: '総務部'
  });

  const entries = db.getEntries({ yearMonth: '2026-03' });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].department, '総務部');

  const summary = db.getMonthlySummary('2026-03');
  assert.equal(summary[0].total_amount, 12000);
});
