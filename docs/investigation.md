# Phase 1 調査結果

調査日: 2026-07-03
対象: `Ruu5LP/dev-init-templates` / `Ruu5LP/dev-workflow` / `Ruu5LP/DevDoctor`（+ 参考として `Ruu5LP/dev-init`）

## 1. Ruu5LP/dev-init-templates

### 概要
`dev-init` CLI が参照するテンプレート集。コードは持たず、テンプレートファイルのみのリポジトリ。

### ディレクトリ構成
```
base/            # 全プロジェクト共通 (.gitignore, .env.example, README.md.hbs)
languages/
  typescript/    # package.json.patch, src/index.ts.hbs, tsconfig.json
features/
  github-actions/ docker/ discord/ line-bot/ lark/ eslint/ prettier/ vitest/
ai/
  _common/company/   # coding-standard / git-workflow / review-policy / security
  _common/project/   # overview.md.hbs / architecture.md.hbs / conventions / testing
  claude/CLAUDE.md.hbs
  codex/CODEX.md.hbs
```
※ README には laravel / python も記載されているが、実ファイルは typescript のみ存在。

### 仕組み
- `.hbs` は Handlebars でレンダリング、それ以外はそのままコピー
- 変数: `projectName` / `description` / `language` / `aiProviders` / `features` / `year` など
- ヘルパー: `hasFeature` / `hasAi` / `eq`
- `package.json.patch` は deepmerge による JSON マージ用パッチ

### CLI化できる処理
- テンプレート合成（base + language + features + ai）→ `foundruu init` の中核
- Handlebars レンダリング / package.json パッチマージ → そのまま流用可能

## 2. Ruu5LP/dev-workflow

### 概要
AI開発セッション管理ツール。開発開始前の「要件ゲート」（要件が実装可能か判定→不足なら質問）を提供。

### 構成
```
.ai/
  prompts/session-workflow.md   # AIエージェント向けワークフロー・ルール
  templates/session/            # requirements / questions / design / tasks / test / summary
  sessions/                     # 実セッション（.gitignore で除外）
bin/ai-session                  # Bash製のセッション作成CLI (start / list / help)
test/ai-session.test.sh
```

### CLI化できる処理
- `.ai/` 一式のプロジェクトへの配置 → `foundruu workflow install`
- `bin/ai-session start/list` の TypeScript 移植 → `foundruu session`（将来）
- ルートディレクトリ探索（git toplevel or `.ai` 探索）ロジック

### 不足しているもの
- 指示書が要求する Development / Feature / Bugfix / Review の各 Workflow は未分化
  （session-workflow.md が単一の開発フローを兼ねている）→ FoundRuu 側で分割・新設する

## 3. Ruu5LP/DevDoctor (ai-dev-doctor)

### 概要
`git diff` と `docs/` を分析し、AI開発プロセスの品質を診断する TypeScript 製 CLI。
commander + simple-git + handlebars。HTML / MD / JSON の3形式レポート出力。

### 構成
```
src/
  cli.ts                    # commander: report --since <ref> --out <dir>
  git/gitDiffCollector.ts   # merge-base からの差分収集
  analyzers/                # fileClassifier / docsScanner
  scoring/                  # rules.ts(440行, 8スコアのルール定義) / scorer / context / sizeClassifier
  report/                   # buildReportData / html,md,json レンダラ / writeReports
  templates/report.hbs
tests/                      # vitest
```

### 特徴
- 8スコア（要件/設計/テスト × 準備/品質、AI指示、プロセス）0〜100点
- 変更規模で軽量/詳細レポートを切替
- ルールが `rules.ts` に集約されており、ルール追加が容易な設計

### CLI化・流用できる処理
- 診断は「diff ベースのプロセス診断」であり、指示書の doctor（**静的なリポジトリ健全性チェック**: README / LICENSE / Docker 等の存在確認）とは観点が異なる
- → FoundRuu doctor は「チェックルールの配列 + ランナー」という DevDoctor の設計思想（rules を宣言的に列挙）を踏襲しつつ、ファイル存在チェック中心に新設する
- diff ベースの品質診断は将来 `foundruu doctor --deep` / `foundruu report` として統合可能

## 4. 参考: Ruu5LP/dev-init

dev-init-templates を消費する既存 CLI。`fetcher(degit) → resolver → renderer(handlebars) → merger(deepmerge) → generator` のパイプライン構成。FoundRuu init はこの設計を踏襲する。

## 5. 共通化・整理

| 項目 | 方針 |
|---|---|
| Handlebars レンダリング | dev-init / DevDoctor 双方で使用 → `core/renderer` に共通化 |
| ルート探索（.ai / git toplevel） | dev-workflow の bash 実装を TS 化して共通化 |
| commander ベースの CLI 骨格 | DevDoctor / dev-init の構成を踏襲 |
| テンプレート実体 | CLI パッケージに同梱（`assets/`）。将来 GitHub から degit で最新取得 |
| 不要になる処理 | dev-workflow の bash CLI（TS へ移植）、DevDoctor の HTML レポート（MVP 対象外）、dev-init の対話プロンプト（`--template` 指定を優先） |

## 6. 結論（FoundRuu CLI への対応マップ）

| FoundRuu コマンド | ベース資産 |
|---|---|
| `foundruu init` | dev-init + dev-init-templates（base/languages/features/ai） |
| `foundruu workflow install` | dev-workflow の `.ai/`（+ 4種 Workflow を新設） |
| `foundruu doctor` | DevDoctor の設計思想（宣言的ルール）で新規実装 |
| `foundruu update` | 同梱アセットの再配置（将来 degit による remote 同期） |
