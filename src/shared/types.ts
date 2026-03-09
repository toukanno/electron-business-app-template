export type EntryType = "income" | "expense";

export interface LedgerEntryInput {
  id?: number;
  entryDate: string;
  voucherNumber: string;
  department: string;
  accountTitle: string;
  counterparty: string;
  description: string;
  entryType: EntryType;
  amount: number;
  taxAmount: number;
  notes: string;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerFilters {
  month: string;
  entryType: "" | EntryType;
  keyword: string;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  entryCount: number;
}

export interface AppSettings {
  organizationName: string;
  fiscalYearStartMonth: number;
}

export interface ExportResult {
  canceled: boolean;
  filePath?: string;
}
