# FoundRuu ロードマップ

## 製品方針（2026-07 更新）

「計測するツール」から「守ってくれるツール」へ。CI/CD 全体やデプロイ管理には広げず、
**ドキュメントと品質の番人**に絞る。新機能は既存の doctor / session 基盤に乗せ、
必ず本リポジトリ自身でドッグフーディングして warn を放置しない。

機能は次の3軸で整理する:

- **導入** — init / workflow install / update / templates
- **番人** — doctor（--fix / --deep / .foundruurc）/ rules / hooks
- **記録・引き継ぎ** — session（CHANGELOG 下書き）/ onboard

計測・集約系（dashboard / cloud push）はこの軸から外れるため、本体から公式プラグイン
`foundruu-plugin-cloud` へ切り出した（コアを「守る」に絞り、計測が欲しい人はプラグインで足す）。

## v1.1 — ライフサイクル拡張（実装済み: PR #34〜#38）

- [x] `foundruu hooks install/uninstall/status`（pre-commit ガードレール）
- [x] `foundruu rules add/list`（レビュー指摘の規約化）
- [x] session end 時の CHANGELOG 下書き自動生成
- [x] doctor 保守運用チェック（docs-freshness / design-promotion）
- [x] `foundruu onboard`（オンボーディングサマリ + MCP ツール）

## v1.2 — 整理（本体を「番人」に絞る）

- [x] cloud push / dashboard を `foundruu-plugin-cloud` に切り出し
- [x] README をコマンド追加順から3軸構成に再編

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
- [x] laravel-vue / nextjs / nuxt テンプレート
- [x] `foundruu init` の対話モード（@inquirer/prompts、テンプレート・名前・説明を対話選択）
- [x] feature の選択的導入（`--features` / 対話チェックボックス）
- [x] docker-compose.yml の言語別分岐（laravel は MySQL つき）

## v0.3 — Update 強化

- [x] GitHub からの最新アセット取得（git shallow clone + ~/.foundruu/cache、オフライン時は同梱へフォールバック）
- [x] 差分表示（`foundruu update --diff`）
- [x] ファイル単位の選択適用（`update --only <paths...>`）
- [x] ユーザー編集済みファイルの保護（導入時 sha256 を foundruu.json に記録して比較）

## v0.4 — Doctor 強化

- [x] DevDoctor の diff ベース品質診断を統合（`foundruu doctor --deep --since <ref>`）
- [x] カテゴリ別スコアリング（要件/設計/テスト/AI指示、改善案つき）
- [x] HTML/MD/JSON レポート出力（`doctor --deep --report <dir>`）
- [x] `.foundruurc` によるチェックのカスタマイズ（無効化・severity 変更）

## v0.5 — セッション管理

- [x] `foundruu session start/list`（dev-workflow の ai-session を TS 移植、サブディレクトリからのルート探索対応）

## v1.0 — プラットフォーム化

- [x] npm publish（[foundruu](https://www.npmjs.com/package/foundruu) v0.1.0、`npx foundruu` で利用可能）
- [x] GitHub Actions（composite action `Ruu5LP/foundruu@main`、fail-on / deep 対応）
- [x] リポジトリ CI（typecheck / test / build / CLI スモークテスト / self-doctor）
- [x] Plugin システム（`foundruu-plugin-*` / foundruu.json plugins の自動ロード、コマンド・doctor チェック拡張）
- [x] MCP Server（`foundruu mcp`、stdio で 6 ツール公開）
- [x] VSCode Extension（vscode-extension/、コマンドパレットから CLI 実行）
- [x] Marketplace の入口（公式プラグイン foundruu-plugin-security を npm 公開）
- [x] スコア推移ダッシュボード（`foundruu dashboard`）
- [x] 旧3リポジトリのアーカイブと誘導 / GitHub Release 自動化 / テンプレート実ビルド週次検証
- [x] Cloud 連携（`foundruu cloud push` + foundruu-cloud リポジトリ + GitHub Pages ダッシュボード）
