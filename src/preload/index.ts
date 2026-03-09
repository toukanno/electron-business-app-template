import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, ExportResult, LedgerEntry, LedgerEntryInput, LedgerFilters, MonthlySummary } from "../shared/types";

const api = {
  listEntries: (filters: LedgerFilters): Promise<LedgerEntry[]> => ipcRenderer.invoke("ledger:list", filters),
  getSummary: (filters: LedgerFilters): Promise<MonthlySummary> => ipcRenderer.invoke("ledger:summary", filters),
  saveEntry: (input: LedgerEntryInput): Promise<LedgerEntry> => ipcRenderer.invoke("ledger:save", input),
  deleteEntry: (id: number): Promise<boolean> => ipcRenderer.invoke("ledger:delete", id),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: AppSettings): Promise<AppSettings> => ipcRenderer.invoke("settings:save", settings),
  exportCsv: (filters: LedgerFilters): Promise<ExportResult> => ipcRenderer.invoke("ledger:exportCsv", filters),
  seedDemoData: (): Promise<boolean> => ipcRenderer.invoke("ledger:seedDemoData")
};

contextBridge.exposeInMainWorld("ledgerApi", api);

declare global {
  interface Window {
    ledgerApi: typeof api;
  }
}
