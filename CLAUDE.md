# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desktop business ledger app (業務帳票デスクトップアプリ) for managing income/expense vouchers with filtering, summaries, and CSV export. Built with Electron 40 + TypeScript + React + Tailwind CSS v4 + Node.js built-in SQLite (`node:sqlite` DatabaseSync).

## Commands

- **Install:** `npm install`
- **Build:** `npm run build` (cleans dist, compiles main/preload via tsc, bundles renderer via esbuild + Tailwind)
- **Dev/Start:** `npm run dev` or `npm start` (build then launch Electron)
- **Test all:** `npm test` (runs `vitest run`)
- **Test single file:** `npx vitest run tests/database.test.ts`
- **Type check only:** `npx tsc --noEmit` (uses tsconfig.json which includes all src + tests)
- **Clean:** `npm run clean` (deletes dist/)
- **Distribution:** `npm run dist:win` (portable) / `npm run dist:mac` (dmg + zip)

## Dependency Direction

```
renderer (React) --IPC via preload--> main (Electron + SQLite)
     |                                    |
     +---------> shared/types <-----------+
```

Renderer never imports from main or preload directly. All communication goes through `window.ledgerApi` (defined in preload) which calls `ipcMain.handle` handlers registered in `src/main/ipc.ts`.

## Architecture

- `src/main/index.ts` — Electron main process entry; creates BrowserWindow, initializes DB and IPC
- `src/main/database.ts` — `LedgerDatabase` class wrapping `node:sqlite` DatabaseSync; handles migrations, CRUD, validation, settings
- `src/main/ipc.ts` — Registers all `ipcMain.handle` channels; also handles CSV export via `dialog.showSaveDialog`
- `src/preload/index.ts` — `contextBridge.exposeInMainWorld("ledgerApi", ...)` bridging IPC to renderer
- `src/renderer/main.tsx` — Single-file React app (all components inline); full UI in one `App` component
- `src/renderer/styles.css` — Tailwind v4 entry point
- `src/shared/types.ts` — Shared TypeScript interfaces used by all layers
- `scripts/build-renderer.mjs` — esbuild bundle + HTML copy + Tailwind CLI build
- `scripts/clean.mjs` — Removes dist/

## Entry Points

| Layer    | Source                      | Compiled Output                |
|----------|-----------------------------|--------------------------------|
| Main     | `src/main/index.ts`         | `dist/main/index.js`           |
| Preload  | `src/preload/index.ts`      | `dist/preload/index.js`        |
| Renderer | `src/renderer/main.tsx`     | `dist/renderer/main.js` (esbuild bundle) |

Main process is compiled with `tsc -p tsconfig.main.json` (CommonJS, ES2022). Renderer is bundled separately by esbuild (IIFE, browser platform).

## Testing Notes

- Framework: Vitest (no config file; uses defaults)
- Tests live in `tests/` directory
- `database.test.ts` tests `LedgerDatabase` directly using `:memory:` SQLite databases
- Tests mock nothing from Electron — `LedgerDatabase` constructor accepts an optional path, so `:memory:` bypasses `app.getPath()`
- Each test creates its own DB instance; cleanup via `afterEach` closing all tracked instances
- The `node:sqlite` module requires Node.js >= 22.5.0 with the `DatabaseSync` API

## Change Rules

### Do Not Modify (without strong justification)

- `tsconfig.main.json` — Main/preload compilation config; changing module format breaks Electron loading
- `tsconfig.json` — Extends main config; only adds JSX and test includes for type checking
- `src/preload/index.ts` — Security boundary (contextIsolation); changes here affect the entire IPC surface
- `src/shared/types.ts` — Shared contract between all layers; changes cascade everywhere
- `scripts/build-renderer.mjs` — Build pipeline; esbuild + Tailwind orchestration
- `package.json` `"type": "commonjs"` — Required for Electron main process module loading

### Before Any Change

1. Run `npx tsc --noEmit` to verify types compile
2. Run `npm test` to verify tests pass
3. If modifying `LedgerDatabase`, add or update tests in `tests/database.test.ts`
4. If adding new IPC channels: update `src/main/ipc.ts`, `src/preload/index.ts`, and `src/shared/types.ts` together
5. If adding renderer dependencies: they must be bundleable by esbuild (no Node.js-only packages)
