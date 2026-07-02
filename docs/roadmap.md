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
- [ ] DevDoctor の diff ベース品質診断を統合（`foundruu doctor --deep`）
- [ ] スコアリング + HTML/MD レポート
- [ ] `.foundruurc` によるチェックのカスタマイズ（無効化・severity 変更）

## v0.5 — セッション管理
- [ ] `foundruu session start/list`（dev-workflow の ai-session を TS 移植）

## v1.0 — プラットフォーム化
- [ ] npm publish（`npx foundruu`）
- [ ] GitHub Actions（doctor を PR チェックとして提供する action）
- [ ] Plugin システム（`foundruu-plugin-*` の自動ロード）
- [ ] MCP Server / VSCode Extension（core ロジックの共有）
- [ ] Cloud 連携 / Marketplace
