import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppSettings, LedgerEntry, LedgerEntryInput, LedgerFilters, MonthlySummary } from "../shared/types";

type EntryFormState = {
  id?: number;
  entryDate: string;
  voucherNumber: string;
  department: string;
  accountTitle: string;
  counterparty: string;
  description: string;
  entryType: LedgerEntryInput["entryType"];
  amount: string;
  taxAmount: string;
  notes: string;
};

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultEntryForm(): EntryFormState {
  return {
    entryDate: todayDate(),
    voucherNumber: "",
    department: "",
    accountTitle: "",
    counterparty: "",
    description: "",
    entryType: "expense",
    amount: "",
    taxAmount: "0",
    notes: ""
  };
}

function toEntryFormState(entry: LedgerEntry): EntryFormState {
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    voucherNumber: entry.voucherNumber,
    department: entry.department,
    accountTitle: entry.accountTitle,
    counterparty: entry.counterparty,
    description: entry.description,
    entryType: entry.entryType,
    amount: String(entry.amount),
    taxAmount: String(entry.taxAmount),
    notes: entry.notes
  };
}

function App(): React.JSX.Element {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>({ totalIncome: 0, totalExpense: 0, balance: 0, entryCount: 0 });
  const [filters, setFilters] = useState<LedgerFilters>({
    month: new Date().toISOString().slice(0, 7),
    entryType: "",
    keyword: ""
  });
  const [form, setForm] = useState<EntryFormState>(defaultEntryForm);
  const [settings, setSettings] = useState<AppSettings>({ organizationName: "帳票管理", fiscalYearStartMonth: 4 });
  const [statusMessage, setStatusMessage] = useState("");

  async function refreshDashboard(nextFilters: LedgerFilters = filters): Promise<void> {
    const [nextEntries, nextSummary] = await Promise.all([
      window.ledgerApi.listEntries(nextFilters),
      window.ledgerApi.getSummary(nextFilters)
    ]);
    setEntries(nextEntries);
    setSummary(nextSummary);
  }

  useEffect(() => {
    void (async () => {
      const nextSettings = await window.ledgerApi.getSettings();
      setSettings(nextSettings);
      await refreshDashboard(filters);
    })().catch((error) => {
      console.error(error);
      setStatusMessage("初期表示に失敗しました。");
    });
  }, []);

  useEffect(() => {
    void refreshDashboard(filters);
  }, [filters.month, filters.entryType, filters.keyword]);

  const fiscalMonthOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}月` }));

  function updateForm<K extends keyof EntryFormState>(key: K, value: EntryFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm(): void {
    setForm(defaultEntryForm());
  }

  async function handleSaveEntry(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form.entryDate || !form.voucherNumber || !form.department || !form.accountTitle || !form.counterparty || !form.description) {
      setStatusMessage("必須項目を入力してください。");
      return;
    }

    const amount = Number(form.amount);
    const taxAmount = Number(form.taxAmount);
    if (Number.isNaN(amount) || Number.isNaN(taxAmount)) {
      setStatusMessage("金額と税額は数値で入力してください。");
      return;
    }

    await window.ledgerApi.saveEntry({
      id: form.id,
      entryDate: form.entryDate,
      voucherNumber: form.voucherNumber.trim(),
      department: form.department.trim(),
      accountTitle: form.accountTitle.trim(),
      counterparty: form.counterparty.trim(),
      description: form.description.trim(),
      entryType: form.entryType,
      amount,
      taxAmount,
      notes: form.notes.trim()
    });
    resetForm();
    await refreshDashboard();
    setStatusMessage("伝票を保存しました。");
  }

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const saved = await window.ledgerApi.saveSettings(settings);
    setSettings(saved);
    setStatusMessage("設定を保存しました。");
  }

  async function handleExport(): Promise<void> {
    const result = await window.ledgerApi.exportCsv(filters);
    setStatusMessage(result.canceled ? "CSV出力をキャンセルしました。" : `CSVを出力しました: ${result.filePath}`);
  }

  async function handleSeed(): Promise<void> {
    await window.ledgerApi.seedDemoData();
    await refreshDashboard();
    setStatusMessage("サンプルデータを投入しました。");
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm(`伝票 #${id} を削除します。`)) {
      return;
    }
    await window.ledgerApi.deleteEntry(id);
    if (form.id === id) {
      resetForm();
    }
    await refreshDashboard();
    setStatusMessage(`伝票 #${id} を削除しました。`);
  }

  return (
    <div className="min-h-screen p-5 text-slate-100 lg:p-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <header className="overflow-hidden rounded-[32px] border border-white/10 bg-white/6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="flex flex-col gap-8 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/80">Business Ledger Workspace</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white lg:text-5xl">{settings.organizationName}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 lg:text-base">
                伝票入力、月次サマリー、検索、CSV 出力を 1 つのデスクトップ画面に統合した業務帳票アプリです。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="収入合計" value={currencyFormatter.format(summary.totalIncome)} tone="emerald" />
              <MetricCard label="支出合計" value={currencyFormatter.format(summary.totalExpense)} tone="rose" />
              <MetricCard label="収支差額" value={currencyFormatter.format(summary.balance)} tone="cyan" />
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Panel title="環境設定" subtitle="表示名と年度開始月を変更できます。">
              <form className="space-y-4" onSubmit={handleSaveSettings}>
                <Field label="組織名">
                  <input
                    className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 text-sm text-white placeholder:text-slate-500"
                    value={settings.organizationName}
                    onChange={(event) => setSettings((current) => ({ ...current, organizationName: event.target.value }))}
                    maxLength={100}
                    required
                  />
                </Field>
                <Field label="年度開始月">
                  <select
                    className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 text-sm text-white"
                    value={settings.fiscalYearStartMonth}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, fiscalYearStartMonth: Number(event.target.value) }))
                    }
                  >
                    {fiscalMonthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="h-12 w-full rounded-2xl bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300" type="submit">
                  設定を保存
                </button>
              </form>
            </Panel>

            <Panel title="データ操作" subtitle="サンプル生成や CSV 出力をここから実行します。">
              <div className="grid gap-3">
                <button className="h-12 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 font-medium text-cyan-200 hover:bg-cyan-400/20" type="button" onClick={handleSeed}>
                  サンプルデータを投入
                </button>
                <button className="h-12 rounded-2xl border border-white/10 bg-white/5 font-medium text-white hover:bg-white/10" type="button" onClick={handleExport}>
                  CSV を出力
                </button>
              </div>
            </Panel>

            <Panel title="アクティビティ" subtitle="最新の処理結果を表示します。">
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-100">
                {statusMessage || "操作メッセージはここに表示されます。"}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoChip label="伝票件数" value={`${summary.entryCount}件`} />
                <InfoChip label="検索月" value={filters.month || "全期間"} />
              </div>
            </Panel>
          </aside>

          <main className="space-y-6">
            <Panel title={form.id ? `伝票編集 #${form.id}` : "新規伝票"} subtitle="業務帳票の入力項目をそのままデスクトップ化しています。">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:justify-end">
                <button className="h-11 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-medium text-white hover:bg-white/10" type="button" onClick={resetForm}>
                  入力をクリア
                </button>
              </div>
              <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSaveEntry}>
                <Field label="日付">
                  <input className="input" type="date" value={form.entryDate} onChange={(event) => updateForm("entryDate", event.target.value)} required />
                </Field>
                <Field label="伝票番号">
                  <input className="input" value={form.voucherNumber} onChange={(event) => updateForm("voucherNumber", event.target.value)} maxLength={30} required />
                </Field>
                <Field label="部門">
                  <input className="input" value={form.department} onChange={(event) => updateForm("department", event.target.value)} maxLength={60} required />
                </Field>
                <Field label="勘定科目">
                  <input className="input" value={form.accountTitle} onChange={(event) => updateForm("accountTitle", event.target.value)} maxLength={60} required />
                </Field>
                <Field label="区分">
                  <select className="input" value={form.entryType} onChange={(event) => updateForm("entryType", event.target.value as EntryFormState["entryType"])}>
                    <option value="expense">支出</option>
                    <option value="income">収入</option>
                  </select>
                </Field>
                <Field label="取引先">
                  <input className="input" value={form.counterparty} onChange={(event) => updateForm("counterparty", event.target.value)} maxLength={60} required />
                </Field>
                <Field className="xl:col-span-2" label="摘要">
                  <input className="input" value={form.description} onChange={(event) => updateForm("description", event.target.value)} maxLength={120} required />
                </Field>
                <Field label="金額">
                  <input className="input" type="number" min="0" step="1" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} required />
                </Field>
                <Field label="税額">
                  <input className="input" type="number" min="0" step="1" value={form.taxAmount} onChange={(event) => updateForm("taxAmount", event.target.value)} required />
                </Field>
                <Field className="md:col-span-2 xl:col-span-4" label="備考">
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    maxLength={300}
                  />
                </Field>
                <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                  <button className="h-12 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 font-semibold text-slate-950 hover:from-cyan-300 hover:to-sky-400" type="submit">
                    保存する
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="帳簿一覧" subtitle="月、区分、キーワードで即時に絞り込みできます。">
              <div className="mb-5 grid gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
                <input className="input" type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} />
                <select className="input" value={filters.entryType} onChange={(event) => setFilters((current) => ({ ...current, entryType: event.target.value as LedgerFilters["entryType"] }))}>
                  <option value="">すべて</option>
                  <option value="income">収入</option>
                  <option value="expense">支出</option>
                </select>
                <input
                  className="input"
                  type="search"
                  placeholder="伝票番号、部門、摘要、取引先で検索"
                  value={filters.keyword}
                  onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                />
              </div>

              <div className="overflow-hidden rounded-[28px] border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-[0.24em] text-slate-400">
                      <tr>
                        {["日付", "伝票番号", "部門", "勘定科目", "区分", "摘要", "金額", "税額", "取引先", "操作"].map((label) => (
                          <th key={label} className="px-4 py-4 font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6 bg-slate-950/40">
                      {entries.length === 0 ? (
                        <tr>
                          <td className="px-4 py-10 text-center text-slate-400" colSpan={10}>
                            条件に一致する伝票はありません。
                          </td>
                        </tr>
                      ) : (
                        entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-4 text-slate-200">{entry.entryDate}</td>
                            <td className="px-4 py-4 text-slate-200">{entry.voucherNumber}</td>
                            <td className="px-4 py-4 text-slate-300">{entry.department}</td>
                            <td className="px-4 py-4 text-slate-300">{entry.accountTitle}</td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  entry.entryType === "income" ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"
                                }`}
                              >
                                {entry.entryType === "income" ? "収入" : "支出"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-slate-300">{entry.description}</td>
                            <td className="px-4 py-4 text-slate-100">{currencyFormatter.format(entry.amount)}</td>
                            <td className="px-4 py-4 text-slate-300">{currencyFormatter.format(entry.taxAmount)}</td>
                            <td className="px-4 py-4 text-slate-300">{entry.counterparty}</td>
                            <td className="px-4 py-4">
                              <div className="flex gap-2">
                                <button
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
                                  type="button"
                                  onClick={() => {
                                    setForm(toEntryFormState(entry));
                                    setStatusMessage(`伝票 #${entry.id} を編集中です。`);
                                  }}
                                >
                                  編集
                                </button>
                                <button
                                  className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-400/20"
                                  type="button"
                                  onClick={() => void handleDelete(entry.id)}
                                >
                                  削除
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          </main>
        </div>
      </div>
    </div>
  );
}

function Panel(props: { title: string; subtitle: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:p-7">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{props.title}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-400">{props.subtitle}</p>
      </div>
      {props.children}
    </section>
  );
}

function Field(props: { label: string; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <label className={`block ${props.className ?? ""}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{props.label}</span>
      {props.children}
    </label>
  );
}

function MetricCard(props: { label: string; value: string; tone: "emerald" | "rose" | "cyan" }): React.JSX.Element {
  const toneClass =
    props.tone === "emerald"
      ? "from-emerald-400/18 to-emerald-200/8 text-emerald-100"
      : props.tone === "rose"
        ? "from-rose-400/18 to-rose-200/8 text-rose-100"
        : "from-cyan-400/18 to-sky-200/8 text-cyan-100";

  return (
    <div className={`min-w-[180px] rounded-[28px] border border-white/10 bg-gradient-to-br ${toneClass} px-5 py-4`}>
      <div className="text-xs uppercase tracking-[0.24em] text-white/60">{props.label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{props.value}</div>
    </div>
  );
}

function InfoChip(props: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-sm font-medium text-slate-200">{props.value}</div>
    </div>
  );
}

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(<App />);
