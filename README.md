# FoundRuu CLI

AI開発を標準化するためのプラットフォーム **FoundRuu** の CLI です。
プロジェクトごとに異なるルール・開発フロー・ドキュメント不足によるAI品質のばらつきを解消し、
人とAIが同じルール・同じ品質で開発できる環境を提供します。

`Ruu5LP/dev-init-templates`（テンプレート）・`Ruu5LP/dev-workflow`（Workflow）・`Ruu5LP/DevDoctor`（診断）の3リポジトリを統合しています。

## インストール

```bash
npm install
npm run build
npm link   # foundruu コマンドとして使えるようにする
```

## コマンド

| コマンド | 説明 |
|---|---|
| `foundruu init [--template <id>] [--name <name>]` | テンプレート + Workflow + Rules + Doctor設定を一括導入 |
| `foundruu workflow install` | Workflow / Prompt / Rules（`.ai/`）のみを既存リポジトリへ導入 |
| `foundruu doctor [--json]` | リポジトリがAI開発可能な状態か診断（fail ありで exit 1） |
| `foundruu update [--force]` | Workflow / Prompt / Rules を最新へ更新 |
| `foundruu templates` | 利用可能なテンプレート一覧 |
| `foundruu --help` / `--version` | ヘルプ / バージョン |

## 利用フロー

```bash
# ① 新しいリポジトリにAI開発環境を構築
mkdir my-app && cd my-app && git init
foundruu init --template typescript --name my-app

# ② 既存リポジトリには Workflow だけ導入
foundruu workflow install

# ③ AIエージェント(Claude Code / Codex)に .ai/ を読ませて開発

# ④ いつでも健全性チェック
foundruu doctor

# ⑤ Workflow を最新へ
foundruu update
```

## init で導入されるもの

```
.ai/
  prompts/session-workflow.md    # 要件ゲート付き開発フロー
  workflows/                     # development / feature / bugfix / review
  templates/session/             # requirements / design / tasks / test / summary 等
docs/ai/                         # 会社共通ルール + プロジェクトルール
CLAUDE.md / CODEX.md             # AIエージェント向けエントリポイント
+ テンプレート本体（src/, tsconfig, ESLint, Prettier, Vitest, Docker, GitHub Actions, .env.example ...）
+ foundruu.json                  # FoundRuu 管理情報（update のバージョン基準）
```

## Doctor のチェック項目

README / LICENSE / .gitignore / .env.example / package.json・composer.json /
Docker / GitHub Actions / AI Rules / Workflow / Prompt / foundruu.json

チェックは [src/doctor/checks.ts](src/doctor/checks.ts) に宣言的に定義されており、1エントリ追加するだけで拡張できます。
`--json` 出力と exit code により GitHub Actions からも利用できます。

## 開発

```bash
npm run dev -- doctor   # ts-node で実行
npm test                # vitest
npm run typecheck
```

## ドキュメント

- [docs/investigation.md](docs/investigation.md) — 3リポジトリの調査結果
- [docs/architecture.md](docs/architecture.md) — 全体アーキテクチャ・設計判断
- [docs/roadmap.md](docs/roadmap.md) — MVP以降のロードマップ

## ライセンス

MIT
