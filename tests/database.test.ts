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

  it("deletes an entry", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    database.saveEntry({
      entryDate: "2026-06-01",
      voucherNumber: "D-001",
      department: "総務課",
      accountTitle: "消耗品費",
      counterparty: "文具店",
      description: "コピー用紙",
      entryType: "expense",
      amount: 5000,
      taxAmount: 500,
      notes: ""
    });

    const before = database.listEntries({ month: "2026-06", entryType: "", keyword: "" });
    expect(before).toHaveLength(1);

    database.deleteEntry(before[0]!.id);

    const after = database.listEntries({ month: "2026-06", entryType: "", keyword: "" });
    expect(after).toHaveLength(0);
  });

  it("updates an existing entry", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    database.saveEntry({
      entryDate: "2026-07-01",
      voucherNumber: "U-001",
      department: "経理課",
      accountTitle: "旅費交通費",
      counterparty: "JR東日本",
      description: "出張交通費",
      entryType: "expense",
      amount: 15000,
      taxAmount: 0,
      notes: ""
    });

    const entries = database.listEntries({ month: "2026-07", entryType: "", keyword: "" });
    const id = entries[0]!.id;

    database.saveEntry({
      id,
      entryDate: "2026-07-01",
      voucherNumber: "U-001",
      department: "経理課",
      accountTitle: "旅費交通費",
      counterparty: "JR東日本",
      description: "出張交通費（修正）",
      entryType: "expense",
      amount: 20000,
      taxAmount: 0,
      notes: "金額修正"
    });

    const updated = database.listEntries({ month: "2026-07", entryType: "", keyword: "" });
    expect(updated).toHaveLength(1);
    expect(updated[0]!.amount).toBe(20000);
    expect(updated[0]!.description).toBe("出張交通費（修正）");
  });

  it("saves and retrieves settings", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    const defaults = database.getSettings();
    expect(typeof defaults.organizationName).toBe("string");
    expect(typeof defaults.fiscalYearStartMonth).toBe("number");

    database.saveSettings({
      organizationName: "テスト株式会社",
      fiscalYearStartMonth: 1
    });

    const saved = database.getSettings();
    expect(saved.organizationName).toBe("テスト株式会社");
    expect(saved.fiscalYearStartMonth).toBe(1);
  });

  it("filters entries by keyword", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    database.saveEntry({
      entryDate: "2026-08-01",
      voucherNumber: "K-001",
      department: "営業課",
      accountTitle: "接待費",
      counterparty: "取引先A",
      description: "会食費用",
      entryType: "expense",
      amount: 30000,
      taxAmount: 3000,
      notes: ""
    });

    database.saveEntry({
      entryDate: "2026-08-02",
      voucherNumber: "K-002",
      department: "総務課",
      accountTitle: "消耗品費",
      counterparty: "文具店B",
      description: "事務用品",
      entryType: "expense",
      amount: 5000,
      taxAmount: 500,
      notes: ""
    });

    const filtered = database.listEntries({ month: "", entryType: "", keyword: "会食" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.voucherNumber).toBe("K-001");
  });

  it("returns zero summary for empty database", () => {
    const database = new LedgerDatabase(":memory:");
    databases.push(database);

    const summary = database.getSummary({ month: "", entryType: "", keyword: "" });
    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpense).toBe(0);
    expect(summary.balance).toBe(0);
    expect(summary.entryCount).toBe(0);
  });
});
