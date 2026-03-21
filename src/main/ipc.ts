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

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (line.length === 0) continue;

    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i]!;
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i += 2;
          } else {
            inQuotes = false;
            i += 1;
          }
        } else {
          current += char;
          i += 1;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i += 1;
        } else if (char === ',') {
          cells.push(current.trim());
          current = "";
          i += 1;
        } else {
          current += char;
          i += 1;
        }
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }

  return rows;
}

export function registerLedgerIpc(database: LedgerDatabase, window: BrowserWindow): void {
  ipcMain.handle("ledger:list", (_event, filters: LedgerFilters) => {
    try {
      return database.listEntries(filters);
    } catch (error) {
      console.error("ledger:list failed:", error);
      throw new Error(`データ取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:summary", (_event, filters: LedgerFilters) => {
    try {
      return database.getSummary(filters);
    } catch (error) {
      console.error("ledger:summary failed:", error);
      throw new Error(`集計に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:save", (_event, input: LedgerEntryInput) => {
    try {
      return database.saveEntry(input);
    } catch (error) {
      console.error("ledger:save failed:", error);
      throw new Error(`伝票の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:delete", (_event, id: number) => {
    try {
      database.deleteEntry(id);
      return true;
    } catch (error) {
      console.error("ledger:delete failed:", error);
      throw new Error(`伝票の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("settings:get", () => {
    try {
      return database.getSettings();
    } catch (error) {
      console.error("settings:get failed:", error);
      throw new Error(`設定の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("settings:save", (_event, settings: AppSettings) => {
    try {
      return database.saveSettings(settings);
    } catch (error) {
      console.error("settings:save failed:", error);
      throw new Error(`設定の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:seedDemoData", () => {
    try {
      database.seedDemoData();
      return true;
    } catch (error) {
      console.error("ledger:seedDemoData failed:", error);
      throw new Error(`サンプルデータの投入に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:exportCsv", async (_event, filters: LedgerFilters): Promise<ExportResult> => {
    try {
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
    } catch (error) {
      console.error("ledger:exportCsv failed:", error);
      throw new Error(`CSV出力に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:exportExcel", async (_event, filters: LedgerFilters): Promise<ExportResult> => {
    try {
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
    } catch (error) {
      console.error("ledger:exportExcel failed:", error);
      throw new Error(`Excel出力に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("ledger:importExcel", async (): Promise<ImportResult> => {
    try {
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
    } catch (error) {
      console.error("ledger:importExcel failed:", error);
      throw new Error(`ファイル取込に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
