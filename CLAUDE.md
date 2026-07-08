# CLAUDE.md

このファイルは Claude Code / AI エージェントが本リポジトリを理解するためのガイドです。
**FoundRuu CLI** 自身のソースリポジトリであり、ドッグフーディング（自作ツールを自分に適用）を方針としています。

---

## プロジェクト概要

- **名称:** FoundRuu CLI (`foundruu`)
- **目的:** 人とAIが同じルール・同じ品質で開発できる環境を提供すること
- **役割:** AI開発を標準化するプラットフォーム。テンプレート / Workflow / Rules / 診断(Doctor) を統合し、人とAIが同じルール・同じ品質で開発できる環境を提供する。
- **言語 / 実行環境:** TypeScript / Node.js `>=22`（ESM）
- **配布形態:** npm パッケージ (`foundruu`) + GitHub Action (`action/`) + VS Code 拡張 (`vscode-extension/`)

---

## リポジトリ構成

| パス               | 内容                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `src/cli.ts`       | CLI エントリポイント（commander ベース）                                                      |
| `src/commands/`    | 各サブコマンド（init / workflow / doctor / update / session / dashboard / cloud / mcp）       |
| `src/core/`        | 共通処理（assets 解決 / config / copier / fetcher / logger / plugins / sync）                 |
| `src/doctor/`      | 診断ロジック（checks / deep / report / runner）                                               |
| `src/registry/`    | テンプレートレジストリ                                                                        |
| `assets/`          | 配布アセット（`workflow/.ai/`・`templates/`）。`init` / `workflow install` がここをコピーする |
| `plugins/`         | プラグイン                                                                                    |
| `tests/`           | Vitest テスト                                                                                 |
| `dist/`            | `npm run build` の出力（tsc）。Git 管理外（.gitignore 対象）                                  |
| `action/index.cjs` | GitHub Action 用バンドル（`npm run build:action` で生成、手編集禁止）                         |

---

## 開発コマンド

```bash
npm run dev -- <args>   # tsx で CLI を直接実行（例: npm run dev -- doctor）
npm run build           # tsc でビルド（dist/ 出力）
npm test                # vitest run（全テスト）
npm run lint            # eslint .
npm run typecheck       # tsc --noEmit
npm run format          # prettier --write .
```

---

## 作業ルール

### 実装前

- 変更方針を簡潔に共有してから着手する。大きな変更はユーザーに確認する。
- 変更範囲は依頼されたタスクに直接関係するファイルに限定する。無関係なリファクタはしない。
- 設計に迷ったら参照するファイル: `docs/architecture.md`（全体設計）、`.ai/prompts/session-workflow.md`（作業フロー）、`.ai/prompts/structure.md`（実装前の整理）

### 実装中

- 小さい単位で実装・確認を繰り返し、テストを壊さない。
- 既存コードのスタイル（命名・コメント量・イディオム）に合わせる。
- ユーザー向け文言・ログ・ドキュメントは日本語で統一する。
- **人間に優しいコード**を心がける（詳細は `.ai/rules/coding-style.md`）:
  - 複数行スコープで生きる変数に1〜2文字名を使わない。1行完結のコールバック引数のみ短縮可。
  - エクスポートする関数・定数には日本語1行の JSDoc（何を・なぜ）を必ず書く。型で自明でない引数にのみ `@param` を添える。

### 実装後（完了条件チェックリスト）

以下をすべて満たすことがタスクの完了条件です。

- [ ] `npm run lint` がパスする
- [ ] `npm run typecheck` がパスする
- [ ] `npm test` が全件パスする
- [ ] CLI の挙動を変えた場合は `npm run build` 後に `node dist/cli.js <cmd>` で実挙動を確認
- [ ] コマンド追加・変更時は README.md / CHANGELOG.md を更新

---

## ドッグフーディング方針

新しいコマンドや機能を追加・変更したら、**まず本リポジトリ自身に適用**して動作と使い勝手を確認する。
`foundruu doctor` の fail / warn は放置せず、解消する方向で検討する。

---

## リリース

- バージョンは `package.json` と各所で管理。リリースは `Release x.y.z` の PR で行う（過去例: #12, #15, #17）。
- `prepublishOnly` で lint / typecheck / build が走る。
