import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { app } from "electron";
import type { AppSettings, LedgerEntry, LedgerEntryInput, LedgerFilters, MonthlySummary } from "../shared/types";

type LedgerRow = {
  id: number;
  entry_date: string;
  voucher_number: string;
  department: string;
  account_title: string;
  counterparty: string;
  description: string;
  entry_type: "income" | "expense";
  amount: number;
  tax_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type SummaryRow = {
  totalIncome: number | null;
  totalExpense: number | null;
  balance: number | null;
  entryCount: number | null;
};

const DEFAULT_SETTINGS: AppSettings = {
  organizationName: "帳票管理",
  fiscalYearStartMonth: 4
};

const LEGACY_ORGANIZATION_NAMES = new Set([
  "省庁向け会計帳簿システム",
  "会計帳簿システム",
  "LedgerFlow"
]);

export class LedgerDatabase {
  private readonly db: DatabaseSync;

  constructor(databasePath?: string) {
    const dbPath = databasePath ?? this.createDefaultDatabasePath();
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.migrate();
    this.seedSettings();
  }

  listEntries(filters: LedgerFilters): LedgerEntry[] {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (filters.month) {
      conditions.push("substr(entry_date, 1, 7) = ?");
      values.push(filters.month);
    }
    if (filters.entryType) {
      conditions.push("entry_type = ?");
      values.push(filters.entryType);
    }
    if (filters.keyword) {
      conditions.push("(voucher_number LIKE ? OR department LIKE ? OR account_title LIKE ? OR counterparty LIKE ? OR description LIKE ? OR notes LIKE ?)");
      const keyword = `%${filters.keyword}%`;
      values.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const statement = this.db.prepare(`
      SELECT id, entry_date, voucher_number, department, account_title, counterparty, description, entry_type, amount, tax_amount, notes, created_at, updated_at
      FROM ledger_entries
      ${whereClause}
      ORDER BY entry_date DESC, id DESC
    `);
    return statement.all(...values).map((row) => this.mapEntry(row as LedgerRow));
  }

  saveEntry(input: LedgerEntryInput): LedgerEntry {
    const now = new Date().toISOString();
    if (input.id) {
      this.db.prepare(`
        UPDATE ledger_entries
        SET entry_date = ?, voucher_number = ?, department = ?, account_title = ?, counterparty = ?, description = ?, entry_type = ?, amount = ?, tax_amount = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.entryDate,
        input.voucherNumber,
        input.department,
        input.accountTitle,
        input.counterparty,
        input.description,
        input.entryType,
        input.amount,
        input.taxAmount,
        input.notes,
        now,
        input.id
      );
      return this.getEntry(input.id);
    }

    const result = this.db.prepare(`
      INSERT INTO ledger_entries (
        entry_date, voucher_number, department, account_title, counterparty, description, entry_type, amount, tax_amount, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.entryDate,
      input.voucherNumber,
      input.department,
      input.accountTitle,
      input.counterparty,
      input.description,
      input.entryType,
      input.amount,
      input.taxAmount,
      input.notes,
      now,
      now
    );
    return this.getEntry(Number(result.lastInsertRowid));
  }

  deleteEntry(id: number): void {
    this.db.prepare("DELETE FROM ledger_entries WHERE id = ?").run(id);
  }

  getSummary(filters: LedgerFilters): MonthlySummary {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (filters.month) {
      conditions.push("substr(entry_date, 1, 7) = ?");
      values.push(filters.month);
    }
    if (filters.entryType) {
      conditions.push("entry_type = ?");
      values.push(filters.entryType);
    }
    if (filters.keyword) {
      conditions.push("(voucher_number LIKE ? OR department LIKE ? OR account_title LIKE ? OR counterparty LIKE ? OR description LIKE ? OR notes LIKE ?)");
      const keyword = `%${filters.keyword}%`;
      values.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END) AS totalIncome,
        SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END) AS totalExpense,
        SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END) AS balance,
        COUNT(*) AS entryCount
      FROM ledger_entries
      ${whereClause}
    `).get(...values) as SummaryRow | undefined;

    return {
      totalIncome: row?.totalIncome ?? 0,
      totalExpense: row?.totalExpense ?? 0,
      balance: row?.balance ?? 0,
      entryCount: row?.entryCount ?? 0
    };
  }

  getSettings(): AppSettings {
    const row = this.db.prepare("SELECT organization_name, fiscal_year_start_month FROM app_settings WHERE id = 1").get() as
      | { organization_name: string; fiscal_year_start_month: number }
      | undefined;
    if (!row) {
      return DEFAULT_SETTINGS;
    }

    if (LEGACY_ORGANIZATION_NAMES.has(row.organization_name)) {
      return this.saveSettings({
        organizationName: DEFAULT_SETTINGS.organizationName,
        fiscalYearStartMonth: row.fiscal_year_start_month
      });
    }

    return {
      organizationName: row.organization_name,
      fiscalYearStartMonth: row.fiscal_year_start_month
    };
  }

  saveSettings(settings: AppSettings): AppSettings {
    this.db.prepare(`
      INSERT INTO app_settings (id, organization_name, fiscal_year_start_month, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organization_name = excluded.organization_name,
        fiscal_year_start_month = excluded.fiscal_year_start_month,
        updated_at = excluded.updated_at
    `).run(settings.organizationName, settings.fiscalYearStartMonth, new Date().toISOString());
    return this.getSettings();
  }

  seedDemoData(): void {
    const countRow = this.db.prepare("SELECT COUNT(*) AS count FROM ledger_entries").get() as { count: number };
    if (countRow.count > 0) {
      return;
    }

    const samples: LedgerEntryInput[] = [
      {
        entryDate: "2026-04-01",
        voucherNumber: "V2026-001",
        department: "管理部",
        accountTitle: "設備保守費",
        counterparty: "オフィスサポート株式会社",
        description: "プリンタ保守契約",
        entryType: "expense",
        amount: 128000,
        taxAmount: 12800,
        notes: "年度初回契約"
      },
      {
        entryDate: "2026-04-08",
        voucherNumber: "V2026-002",
        department: "経理部",
        accountTitle: "サービス収入",
        counterparty: "主要取引先A",
        description: "月次利用料入金",
        entryType: "income",
        amount: 560000,
        taxAmount: 0,
        notes: ""
      },
      {
        entryDate: "2026-04-12",
        voucherNumber: "V2026-003",
        department: "情報システム部",
        accountTitle: "委託料",
        counterparty: "プロダクト開発会社",
        description: "業務帳票アプリ改修費",
        entryType: "expense",
        amount: 320000,
        taxAmount: 32000,
        notes: "第1フェーズ"
      }
    ];

    for (const sample of samples) {
      this.saveEntry(sample);
    }
  }

  close(): void {
    this.db.close();
  }

  private createDefaultDatabasePath(): string {
    return join(app.getPath("userData"), "ledger.sqlite");
  }

  private getEntry(id: number): LedgerEntry {
    const row = this.db.prepare(`
      SELECT id, entry_date, voucher_number, department, account_title, counterparty, description, entry_type, amount, tax_amount, notes, created_at, updated_at
      FROM ledger_entries
      WHERE id = ?
    `).get(id) as LedgerRow | undefined;

    if (!row) {
      throw new Error(`Entry not found: ${id}`);
    }
    return this.mapEntry(row);
  }

  private mapEntry(row: LedgerRow): LedgerEntry {
    return {
      id: row.id,
      entryDate: row.entry_date,
      voucherNumber: row.voucher_number,
      department: row.department,
      accountTitle: row.account_title,
      counterparty: row.counterparty,
      description: row.description,
      entryType: row.entry_type,
      amount: row.amount,
      taxAmount: row.tax_amount,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date TEXT NOT NULL,
        voucher_number TEXT NOT NULL,
        department TEXT NOT NULL,
        account_title TEXT NOT NULL,
        counterparty TEXT NOT NULL,
        description TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK(entry_type IN ('income', 'expense')),
        amount REAL NOT NULL CHECK(amount >= 0),
        tax_amount REAL NOT NULL DEFAULT 0 CHECK(tax_amount >= 0),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        organization_name TEXT NOT NULL,
        fiscal_year_start_month INTEGER NOT NULL CHECK(fiscal_year_start_month BETWEEN 1 AND 12),
        updated_at TEXT NOT NULL
      );
    `);
  }

  private seedSettings(): void {
    const existing = this.db.prepare("SELECT id FROM app_settings WHERE id = 1").get() as { id: number } | undefined;
    if (existing) {
      return;
    }
    this.saveSettings(DEFAULT_SETTINGS);
  }
}
