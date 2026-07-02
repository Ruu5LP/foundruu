# FoundRuu ロードマップ

## v0.1 (MVP) — 本実装
- [x] `foundruu --help` / `--version`
- [x] `foundruu init [--template <id>] [--name <project>]`（typescript テンプレート）
- [x] `foundruu workflow install`（.ai/ 一式 + Development/Feature/Bugfix/Review Workflow）
- [x] `foundruu doctor`（11項目の健全性チェック、`--json` 対応）
- [x] `foundruu update`（同梱アセットによる workflow 再配置、`--force`）
- [x] `foundruu.json` によるバージョン記録
- [x] vitest によるテスト

## v0.2 — テンプレート拡充
- [x] laravel-react テンプレート（composer.json / Vite + laravel-vite-plugin / PHP CI / SETUP ガイド）
- [x] node-react テンプレート（Vite + React + TypeScript）
- [x] テキストファイルへの `.patch` 追記対応（.env.example 等）
- [ ] laravel-vue / nextjs / nuxt テンプレート
- [x] `foundruu init` の対話モード（@inquirer/prompts、テンプレート・名前・説明を対話選択）
- [ ] feature の選択的導入（`--features docker,vitest`）
- [ ] docker-compose.yml の言語別分岐（現状 Node 前提）

## v0.3 — Update 強化
- [x] GitHub からの最新アセット取得（git shallow clone + ~/.foundruu/cache、オフライン時は同梱へフォールバック）
- [x] 差分表示（`foundruu update --diff`）
- [ ] ファイル単位の選択適用 / 強制更新
- [x] ユーザー編集済みファイルの保護（導入時 sha256 を foundruu.json に記録して比較）

## v0.4 — Doctor 強化
- [x] DevDoctor の diff ベース品質診断を統合（`foundruu doctor --deep --since <ref>`）
- [x] カテゴリ別スコアリング（要件/設計/テスト/AI指示、改善案つき）
- [ ] HTML/MD レポート出力
- [x] `.foundruurc` によるチェックのカスタマイズ（無効化・severity 変更）

## v0.5 — セッション管理
- [x] `foundruu session start/list`（dev-workflow の ai-session を TS 移植、サブディレクトリからのルート探索対応）

## v1.0 — プラットフォーム化
- [x] npm publish（[foundruu](https://www.npmjs.com/package/foundruu) v0.1.0、`npx foundruu` で利用可能）
- [x] GitHub Actions（composite action `Ruu5LP/RuunFoundry@main`、fail-on / deep 対応）
- [x] リポジトリ CI（typecheck / test / build / CLI スモークテスト / self-doctor）
- [x] Plugin システム（`foundruu-plugin-*` / foundruu.json plugins の自動ロード、コマンド・doctor チェック拡張）
- [ ] MCP Server / VSCode Extension（core ロジックの共有）
- [ ] Cloud 連携 / Marketplace
