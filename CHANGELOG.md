# Changelog

このプロジェクトの主な変更点を記録します。
形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

## [Unreleased]

### Added

- コマンド層(`dashboard` / `workflow` / `update` / `cloud` / `init` / `mcp`)のテストを追加。カバレッジ計測を導入し、回帰防止の下限しきい値を CI で強制（statements 約48% → 約79%）
- 公式プラグイン `foundruu-plugin-node`（Node バージョン固定 / ロックファイル / node_modules の gitignore チェック）

### Changed

- `.claude/settings.local.json`（個人設定）を `.gitignore` に追加

## [0.7.1] - 2026-07-04

### Added

- ESLint + Prettier を導入し、`lint` / `format` スクリプトと CI ステップを追加
- コアモジュール（config / fetcher / logger）のテストを追加
- プラグイン開発ガイド [docs/PLUGIN_DEV.md](docs/PLUGIN_DEV.md)
- カバレッジ計測（vitest v8）

### Changed

- GitHub Action を Marketplace 対応に。依存ごと単一ファイルへバンドルし、実行時の
  npm install / TypeScript ビルドを排除（`node` で即実行）
- README の Action 例をリリースタグ固定（`@v0.7.1`）へ

## [0.7.0] - 2026-07-03

### Added

- `foundruu cloud push` — deep レポートを foundruu-cloud へ集約送信

## [0.6.0] - 2026-07-03

### Added

- `foundruu dashboard` — deep レポート履歴からスコア推移ダッシュボード（HTML）を生成
- 公式プラグイン `foundruu-plugin-security`

## [0.5.0] - 2026-07-03

### Added

- `foundruu init --features`、テンプレートのレイヤー合成、`foundruu update --only`、
  `doctor --deep`（プロセス品質スコア診断）、VSCode 拡張

### Changed

- リポジトリを `Ruu5LP/foundruu` へリネームし、参照を統一

## [0.4.0] - 2026-07-03

### Added

- テンプレート追加: `laravel-vue` / `nextjs` / `nuxt`
- GitHub Packages への publish ワークフロー

## [0.3.0] - 2026-07-03

### Added

- MCP サーバー（`foundruu mcp`）— AI エージェントが doctor / session / workflow / update をツールとして呼べる

## [0.2.0] - 2026-07-03

### Added

- プラグインシステム（`foundruu-plugin-*` の自動読み込み、コマンド / doctor チェックの拡張）

## [0.1.0] - 2026-07-03

### Added

- 初回リリース。`init` / `workflow` / `doctor` / `session` / `templates` と npm 公開

[Unreleased]: https://github.com/Ruu5LP/foundruu/compare/v0.7.1...HEAD
[0.7.1]: https://github.com/Ruu5LP/foundruu/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/Ruu5LP/foundruu/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Ruu5LP/foundruu/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Ruu5LP/foundruu/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Ruu5LP/foundruu/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ruu5LP/foundruu/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ruu5LP/foundruu/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ruu5LP/foundruu/releases/tag/v0.1.0
