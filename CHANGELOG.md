# Changelog

このプロジェクトの主な変更点を記録します。
形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

## [Unreleased]

### Added

- **Python を正式サポート**（テンプレート `python`、FastAPI ベース）。他言語と同水準の厳格な機械チェックを同梱
  - `pyproject.toml`: Ruff（lint + format）と mypy（`strict` + `disallow_any_explicit`）を設定。`Any` 禁止・命名規約（`snake_case` 等）・型注釈必須・未使用コード検出などをコーディング規約と対応付けて有効化。日本語コメントの全角記号は誤検知しないよう `RUF001-003` のみ除外
  - `main.py` / `tests/test_main.py`（FastAPI + `TestClient`）、`requirements.txt` / `requirements-dev.txt`、Python 向け `.gitignore`、`docs/SETUP.md` を生成
  - Docker（`python:3.14-slim` + uvicorn）と GitHub Actions（`ruff check` / `ruff format --check` / `mypy` / `pytest`）に対応。生成物が自身の厳格チェックを緑で通過することを確認
  - AI 向けチェックリスト（CLAUDE.md / CODEX.md）に Python 用コマンドを追加。コーディング規約の「自動チェックの範囲」に Python を追記
- `workflow install`（`init` 経由含む）で、Prettier を使っているプロジェクトには `.prettierignore` に `.ai` を自動追記するようにした。管理対象の `.ai/` がローカル整形でハッシュ変化し、`foundruu update` にユーザー編集と誤検知されるのを防ぐ（`.prettierrc*` / `prettier.config.*` / `package.json` の `prettier` キーで使用を判定。未使用時は何も作らない）

### Changed

- 配布するコーディングルールを大幅に強化。「言語標準リンター任せ」で緩かった規約を、全配布言語で同水準に引き上げた
  - **コーディング規約（`.ai/`）**: 「リンターが緑でも規約違反は不可」を明記。無理やり型を合わせるキャスト（`as any` / `as unknown as T` / `!` / `@ts-ignore`）の明示禁止、状態を極力持たない方針、意味ごとの命名プレフィクス表、ファイル肥大化・ディレクトリ構造の規律を追加
  - **ESLint（TypeScript / Next.js）**: `recommended` から型情報ベースの `strictTypeChecked` + `stylisticTypeChecked` へ格上げ。`no-explicit-any`/`no-non-null-assertion`/`ban-ts-comment`/`no-floating-promises`/`switch-exhaustiveness-check`/`naming-convention`/`max-lines` などを規約と1対1で有効化
  - **Nuxt**: `@nuxt/eslint`（Vue + TypeScript 対応）を標準同梱し、同等の厳格ルールを適用。さらに `.ts` / `.tsx` には型情報を使う `strictTypeChecked` + `stylisticTypeChecked`（`no-floating-promises` 等の型フロー系）をスコープ適用し、TS/Next と同水準に。`lint` / `typecheck` スクリプトを追加
  - **Laravel**: Larastan/PHPStan を追加（`phpstan.neon`、`level: 8` を最低ライン）。`composer lint` / `analyse` スクリプトと、AI チェックリストへの反映を追加

### Fixed

- 上記コーディングルール強化の穴を、厳格レビュー観点で追加修正
  - **`typecheck` スクリプト欠落**: TypeScript / Next.js の `package.json` に `typecheck`（`tsc --noEmit`）が無く、AI チェックリストの「`npm run typecheck` を実行」が `Missing script` で失敗していた。両テンプレートに追加
  - **ファイル肥大化・複雑度チェックが実質無効**: `max-lines` / `complexity` 等を `warn` にしていたが `lint` は `eslint .` のみで、警告が出ても緑になっていた。`lint` を `--max-warnings 0` に変更し、チェックリスト文言も「警告・エラーがゼロ」に更新
  - **Prettier と整形ルールの競合**: `stylisticTypeChecked` と Prettier が衝突していた。`eslint-config-prettier` を導入し、Prettier 併用時のみ ESLint 設定末尾で整形ルールを無効化（TypeScript / Nuxt 両方、feature 選択に応じてテンプレート化）
  - **Nuxt `.vue` の型認識チェック限界を明記**: `.vue` では `await` 漏れ検出等が効かないため、async ロジックは composable（`.ts`）へ寄せる旨を規約に追記
  - **自動チェックの範囲を明文化**: 機械強制される項目と、レビューで見る項目（命名の動詞使い分け・Python 等ツールチェーン未同梱言語）の境界を規約に追加
  - **ESLint のメジャーバージョン統一**: feature 側 `eslint` ^10 と Nuxt 側 ^9 の食い違いを ^9 に統一（`typescript-eslint` ^8 の対応範囲に合わせる）

## [0.11.0] - 2026-07-05

### Changed

- `doctor --deep`: ドキュメント検出パターンを拡張。`architecture.md`→設計、`spec.md`/`prd.md`→要件、`AGENTS.md`/`CODEX.md`→AI指示、`テスト.md` など、決まったファイル名以外の一般的な別名も拾えるようにした

## [0.10.0] - 2026-07-05

### Added

- ダッシュボードに「改善アクション」セクションを追加。各カテゴリの未達項目と具体的な改善方法（`label → improvement`）をスコアの低い順に表示し、スコアだけでなく次に何をすべきかが分かるようにした

### Changed

- `doctor --deep`: 該当ドキュメントが無いカテゴリを「0点」ではなく「未計測」とし、総合スコアの平均から除外。ドキュメントが揃っていないプロジェクトが不当に 0 点になる問題を修正（ターミナル / dashboard / md / html レポートすべてに反映）

## [0.9.0] - 2026-07-05

### Added

- `foundruu doctor --fix` — README / LICENSE / .gitignore / .env.example の欠如を最小構成で自動生成する（既存ファイルは上書きしない）
- セッションのライフサイクル: `session show` / `session end` / `session current`。`session start` が「現在のセッション」を設定し、`end` で完了を記録する（メタ情報はセッションディレクトリ外に保存）

## [0.8.0] - 2026-07-05

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

[Unreleased]: https://github.com/Ruu5LP/foundruu/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/Ruu5LP/foundruu/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/Ruu5LP/foundruu/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Ruu5LP/foundruu/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Ruu5LP/foundruu/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/Ruu5LP/foundruu/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/Ruu5LP/foundruu/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Ruu5LP/foundruu/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Ruu5LP/foundruu/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Ruu5LP/foundruu/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ruu5LP/foundruu/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ruu5LP/foundruu/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ruu5LP/foundruu/releases/tag/v0.1.0
