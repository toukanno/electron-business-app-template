import { afterEach, describe, expect, it } from "vitest";
import { LedgerDatabase } from "../src/main/database";

const databases: LedgerDatabase[] = [];

afterEach(() => {
  while (databases.length > 0) {
    databases.pop()?.close();
  }
});

describe("LedgerDatabase", () => {
  it("saves and lists ledger entries", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    database.saveEntry({
      entryDate: "2026-05-01",
      voucherNumber: "A-001",
      department: "会計課",
      accountTitle: "委託料",
      counterparty: "外部ベンダー",
      description: "帳簿移行作業",
      entryType: "expense",
      amount: 100000,
      taxAmount: 10000,
      notes: "初回"
    });

    const entries = database.listEntries({ month: "2026-05", entryType: "", keyword: "" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.voucherNumber).toBe("A-001");
  });

  it("calculates summaries by type", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    database.saveEntry({
      entryDate: "2026-05-01",
      voucherNumber: "A-001",
      department: "会計課",
      accountTitle: "補助金収入",
      counterparty: "国庫",
      description: "交付金",
      entryType: "income",
      amount: 300000,
      taxAmount: 0,
      notes: ""
    });

    database.saveEntry({
      entryDate: "2026-05-02",
      voucherNumber: "A-002",
      department: "会計課",
      accountTitle: "委託料",
      counterparty: "外部ベンダー",
      description: "保守",
      entryType: "expense",
      amount: 120000,
      taxAmount: 12000,
      notes: ""
    });

    const summary = database.getSummary({ month: "2026-05", entryType: "", keyword: "" });
    expect(summary.totalIncome).toBe(300000);
    expect(summary.totalExpense).toBe(120000);
    expect(summary.balance).toBe(180000);
    expect(summary.entryCount).toBe(2);
  });

  it("rejects invalid entry payloads", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    expect(() =>
      database.saveEntry({
        entryDate: "2026-05-40",
        voucherNumber: " ",
        department: "会計課",
        accountTitle: "委託料",
        counterparty: "外部ベンダー",
        description: "帳簿移行作業",
        entryType: "expense",
        amount: -1,
        taxAmount: 0,
        notes: ""
      })
    ).toThrow();
  });

  it("normalizes settings and validates fiscal year month", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    const saved = database.saveSettings({
      organizationName: "  新組織名  ",
      fiscalYearStartMonth: 4
    });

    expect(saved.organizationName).toBe("新組織名");
    expect(() =>
      database.saveSettings({
        organizationName: "新組織名",
        fiscalYearStartMonth: 13
      })
    ).toThrow();
  });
});
