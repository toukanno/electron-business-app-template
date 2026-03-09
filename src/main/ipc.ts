import { dialog, ipcMain, type BrowserWindow } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { LedgerDatabase } from "./database";
import type { AppSettings, ExportResult, ImportResult, LedgerEntryInput, LedgerFilters } from "../shared/types";

function toCsvCell(value: string | number): string {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function escapeXml(value: string | number): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toEntryRows(database: LedgerDatabase, filters: LedgerFilters): (string | number)[][] {
  const entries = database.listEntries(filters);
  return entries.map((entry) => [
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
}

function parseEntryType(value: unknown): LedgerEntryInput["entryType"] {
  return String(value ?? "").trim() === "収入" || String(value ?? "").trim() === "income" ? "income" : "expense";
}

function toNumber(value: unknown): number {
  const normalized = String(value ?? "").trim().replaceAll(",", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapImportValues(values: string[]): LedgerEntryInput {
  return {
    entryDate: (values[1] ?? "").trim(),
    voucherNumber: (values[0] ?? "").trim(),
    department: (values[2] ?? "").trim(),
    accountTitle: (values[3] ?? "").trim(),
    entryType: parseEntryType(values[4] ?? ""),
    counterparty: (values[5] ?? "").trim(),
    description: (values[6] ?? "").trim(),
    amount: toNumber(values[7] ?? "0"),
    taxAmount: toNumber(values[8] ?? "0"),
    notes: (values[9] ?? "").trim()
  };
}

function validateEntry(entry: LedgerEntryInput): string | null {
  if (!entry.entryDate || !entry.voucherNumber || !entry.department || !entry.accountTitle || !entry.counterparty || !entry.description) {
    return "必須項目に空欄があります";
  }
  return null;
}

function buildSpreadsheetXml(rows: (string | number)[][]): string {
  const xmlRows = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell, index) => {
            const type = index >= 7 && index <= 8 ? "Number" : "String";
            return `<Cell><Data ss:Type=\"${type}\">${escapeXml(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("\n");

  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n  <Worksheet ss:Name="Ledger">\n    <Table>\n${xmlRows}\n    </Table>\n  </Worksheet>\n</Workbook>`;
}

function parseSpreadsheetXml(content: string): string[][] {
  const rows = [...content.matchAll(/<Row[^>]*>([\s\S]*?)<\/Row>/g)];
  return rows.map((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/g)];
    return cells.map((cellMatch) =>
      cellMatch[1]
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'")
        .replaceAll("&amp;", "&")
        .trim()
    );
  });
}

function parseCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .split(",")
        .map((cell) => cell.trim().replace(/^"|"$/g, "").replaceAll('""', '"'))
    );
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
    const saveResult = await dialog.showSaveDialog(window, {
      defaultPath: "ledger-export.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    const header = ["伝票番号", "日付", "部門", "勘定科目", "区分", "取引先", "摘要", "金額", "税額", "備考"];
    const rows = toEntryRows(database, filters);
    const csv = [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
    await writeFile(saveResult.filePath, `\uFEFF${csv}`, "utf8");
    return { canceled: false, filePath: saveResult.filePath };
  });
  ipcMain.handle("ledger:exportExcel", async (_event, filters: LedgerFilters): Promise<ExportResult> => {
    const saveResult = await dialog.showSaveDialog(window, {
      defaultPath: "ledger-export.xml",
      filters: [{ name: "Excel XML", extensions: ["xml"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    const header = ["伝票番号", "日付", "部門", "勘定科目", "区分", "取引先", "摘要", "金額", "税額", "備考"];
    const rows = toEntryRows(database, filters);
    await writeFile(saveResult.filePath, buildSpreadsheetXml([header, ...rows]), "utf8");
    return { canceled: false, filePath: saveResult.filePath };
  });
  ipcMain.handle("ledger:importExcel", async (): Promise<ImportResult> => {
    const openResult = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "Excel/CSV", extensions: ["xml", "csv"] }]
    });

    if (openResult.canceled || openResult.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = openResult.filePaths[0];
    if (!filePath) {
      return { canceled: true };
    }

    const content = await readFile(filePath, "utf8");
    const rows = filePath.endsWith(".xml") ? parseSpreadsheetXml(content) : parseCsv(content.replace(/^\uFEFF/, ""));

    let importedCount = 0;
    const errors: string[] = [];
    rows.slice(1).forEach((row, index) => {
      const entry = mapImportValues(row);
      const validationError = validateEntry(entry);
      if (validationError) {
        errors.push(`${index + 2}行目: ${validationError}`);
        return;
      }
      database.saveEntry(entry);
      importedCount += 1;
    });

    return { canceled: false, importedCount, errors };
  });
}
