import { dialog, ipcMain, type BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import { LedgerDatabase } from "./database";
import type { AppSettings, ExportResult, LedgerEntryInput, LedgerFilters } from "../shared/types";

function toCsvCell(value: string | number): string {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

export function registerLedgerIpc(database: LedgerDatabase, window: BrowserWindow): void {
  ipcMain.handle("ledger:list", (_event, filters: LedgerFilters) => database.listEntries(filters));
  ipcMain.handle("ledger:summary", (_event, filters: LedgerFilters) => database.getSummary(filters));
  ipcMain.handle("ledger:save", (_event, input: LedgerEntryInput) => database.saveEntry(input));
  ipcMain.handle("ledger:delete", (_event, id: number) => {
    database.deleteEntry(id);
    return true;
  });
  ipcMain.handle("settings:get", () => database.getSettings());
  ipcMain.handle("settings:save", (_event, settings: AppSettings) => database.saveSettings(settings));
  ipcMain.handle("ledger:seedDemoData", () => {
    database.seedDemoData();
    return true;
  });
  ipcMain.handle("ledger:exportCsv", async (_event, filters: LedgerFilters): Promise<ExportResult> => {
    const entries = database.listEntries(filters);
    const saveResult = await dialog.showSaveDialog(window, {
      defaultPath: "ledger-export.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    const header = ["伝票番号", "日付", "部門", "勘定科目", "区分", "取引先", "摘要", "金額", "税額", "備考"];
    const rows = entries.map((entry) => [
      entry.voucherNumber,
      entry.entryDate,
      entry.department,
      entry.accountTitle,
      entry.entryType === "income" ? "収入" : "支出",
      entry.counterparty,
      entry.description,
      entry.amount,
      entry.taxAmount,
      entry.notes
    ]);

    const csv = [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
    await writeFile(saveResult.filePath, `\uFEFF${csv}`, "utf8");
    return { canceled: false, filePath: saveResult.filePath };
  });
}
