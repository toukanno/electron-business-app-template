# 業務帳票デスクトップアプリ

Electron + TypeScript + React + Tailwind CSS + SQLite で構築した、業務帳票作成向けのデスクトップアプリです。

## 機能

- 収入・支出の伝票登録、更新、削除
- 月次フィルタ、種別フィルタ、キーワード検索
- 収入合計、支出合計、収支差額、件数の集計表示
- 組織名と年度開始月の設定
- SQLite 永続化
- CSV 出力
- 入力値バリデーションと保存時エラーハンドリング

## Tech Stack

- Electron
- TypeScript
- React
- Tailwind CSS
- SQLite (better-sqlite3)

## セットアップ

```bash
npm install
npm run build
npm start
```

## 配布

```bash
npm run dist:win
npm run dist:mac
```

`macOS` 向けビルドは macOS 環境での署名と検証が必要です。`iOS` は Electron の配布対象外なので、対応する場合は Web 化した UI を `Capacitor` などで別アプリ化する必要があります。整理は [docs/platform-roadmap.md](/C:/Users/masayosiyuuto/Documents/Project/electron-business-app-template/docs/platform-roadmap.md) にまとめています。

## テスト

```bash
npm test
```
