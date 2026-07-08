# FoundRuu CLI

AI開発を標準化するためのプラットフォーム **FoundRuu** の CLI です。
プロジェクトごとに異なるルール・開発フロー・ドキュメント不足によるAI品質のばらつきを解消し、
人とAIが同じルール・同じ品質で開発できる環境を提供します。

`Ruu5LP/dev-init-templates`（テンプレート）・`Ruu5LP/dev-workflow`（Workflow）・`Ruu5LP/DevDoctor`（診断）の3リポジトリを統合しています。

## インストール

```bash
npm install -g foundruu   # または npx foundruu <command>
```

ソースから使う場合:

```bash
npm install && npm run build && npm link
```

## コマンド

| コマンド                                                              | 説明                                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `foundruu init [--template <id>] [--features <list>]`                 | テンプレート + Workflow + Rules + Doctor設定を一括導入                                             |
| `foundruu workflow install`                                           | Workflow / Prompt / Rules（`.ai/`）のみを既存リポジトリへ導入                                      |
| `foundruu doctor [--json] [--fix]`                                    | リポジトリがAI開発可能な状態か診断（`--fix` で README/LICENSE/.gitignore/.env.example を自動生成） |
| `foundruu doctor --deep [--since <ref>] [--report <dir>]`             | AI開発プロセス品質をスコア診断（md/html/json レポート出力可）                                      |
| `foundruu hooks install` / `uninstall` / `status`                     | pre-commit フックを管理（コミット前に doctor を実行し、fail ならコミットを中止）                   |
| `foundruu rules add "<text>"` / `rules list`                          | レビュー指摘を `.ai/rules/` へ規約化して再発防止（`--file` で追記先指定可）                        |
| `foundruu update [--force] [--diff] [--only <paths...>]`              | Workflow / Prompt / Rules を最新へ更新（パス指定・差分確認可）                                     |
| `foundruu session start <name>` / `list` / `show` / `end` / `current` | AI開発セッションの作成 / 一覧 / 状態表示 / 完了（CHANGELOG 下書きを自動生成） / 現在のセッション   |
| `foundruu templates`                                                  | 利用可能なテンプレート一覧                                                                         |
| `foundruu plugins`                                                    | 読み込まれているプラグイン一覧                                                                     |
| `foundruu mcp`                                                        | MCP サーバーを起動（AIエージェント連携）                                                           |
| `foundruu dashboard [--dir <dir>] [--out <file>]`                     | deep レポート履歴からスコア推移ダッシュボード(HTML)を生成（既定: `reports/index.html`）            |
| `foundruu cloud push`                                                 | 最新の deep レポートを [foundruu-cloud](https://github.com/Ruu5LP/foundruu-cloud) へ送信           |
| `foundruu --help` / `--version`                                       | ヘルプ / バージョン                                                                                |

## テンプレート

| ID              | 内容               |
| --------------- | ------------------ |
| `typescript`    | TypeScript（既定） |
| `node-react`    | Node.js + React    |
| `nextjs`        | Next.js            |
| `nuxt`          | Nuxt               |
| `laravel-react` | Laravel + React    |
| `laravel-vue`   | Laravel + Vue      |
| `python`        | Python (FastAPI)   |

全テンプレートに、コーディング規約と対応した厳格な機械チェック（ESLint `strictTypeChecked` /
PHPStan level 8 / Ruff + mypy strict など）と、それを CI で強制する GitHub Actions
（typecheck / lint / 静的解析 / テスト / 依存監査）が同梱されます。

## 利用フロー

```bash
# ① 新しいリポジトリにAI開発環境を構築
mkdir my-app && cd my-app && git init
foundruu init --template typescript --name my-app --features docker,vitest

# ② 既存リポジトリには Workflow だけ導入
foundruu workflow install

# ③ セッションを作成し、AIエージェントに .ai/ を読ませて開発
foundruu session start add-login-api

# ④ いつでも健全性チェック
foundruu doctor

# ⑤ Workflow を最新へ
foundruu update
```

## init で導入されるもの

```
.ai/
  prompts/session-workflow.md    # 要件ゲート付き開発フロー
  prompts/structure.md           # 実装前の構造化整理（目的→影響範囲→段階分け→依存関係→リスク）
  workflows/                     # development / feature / bugfix / review
  templates/session/             # requirements / design / tasks / test / summary 等
docs/ai/                         # 会社共通ルール + プロジェクトルール
CLAUDE.md / CODEX.md             # AIエージェント向けエントリポイント
+ テンプレート本体（src/, tsconfig, ESLint, Prettier, Vitest, Docker, GitHub Actions, .env.example ...）
+ foundruu.json                  # FoundRuu 管理情報（update のバージョン基準）
```

既存プロジェクトへの後入れも安全です: 既存ファイルは上書きせずスキップし、`package.json` 等への
JSON パッチは新規キーのみ追加します。既存の値とテンプレートの値が食い違うキーは既存値を維持し、
`⚠ 既存の設定値を維持しました` として差分を表示します。

## Doctor のチェック項目

README / LICENSE / .gitignore / .env.example / package.json・composer.json /
Docker / GitHub Actions / AI Rules / Workflow / Prompt / 進行中セッションの要件 / foundruu.json

`foundruu hooks install` で pre-commit フックを導入すると、コミット前に doctor が自動実行され、
fail があるコミットはその場で止まります（緊急時は `git commit --no-verify`）。

チェックは [src/doctor/checks.ts](src/doctor/checks.ts) に宣言的に定義されており、1エントリ追加するだけで拡張できます。
`--json` 出力と exit code により GitHub Actions からも利用できます。

`foundruu doctor --fix` は、欠けている README / LICENSE / .gitignore / .env.example を最小構成で自動生成してから再診断します（既存ファイルは上書きしません）。

プロジェクトルートの `.foundruurc` でカスタマイズできます:

```json
{
  "doctor": {
    "disable": ["docker"],
    "severity": { "license": "error" }
  }
}
```

`foundruu doctor --deep` は DevDoctor 由来の品質診断で、docs/（および最新の `.ai/sessions/`）の
要件・設計・計画（タスク分解）・テスト・AI指示ドキュメントをスコア化し、不足観点と改善案を提示します。

プロジェクトに合わない採点観点は `doctor.deep.disable` で無効化できます（採点の分母から除外されます）。
ルール ID は `--deep --json` 出力の `failed[].id` で確認できます:

```json
{
  "doctor": {
    "deep": {
      "disable": ["design.api-io", "design.rollback"]
    }
  }
}
```

例えば CLI ツールやライブラリでは、Web アプリ前提の `design.api-io`（API入出力）や
`design.rollback`（ロールバック方針）を外すと、スコアが実態に即したものになります。

### トレーサビリティ（要件・設計とコードの紐づけ）

`doctor --deep` はドキュメント単体の採点に加えて、要件・設計と実際のコードの対応も検証します:

- **設計 ↔ 差分**: 変更されたファイルが設計ドキュメント（最新セッションの `design.md` を優先）に
  記載されているかを突き合わせ、記載のない変更ファイルを警告します。`.ai/**`・`**/*.md`・
  lockfile はデフォルトで対象外。生成物などは `doctor.deep.trace.exclude` に glob で追加除外できます:

```json
{
  "doctor": {
    "deep": {
      "trace": { "exclude": ["action/index.cjs", "dist/**"] }
    }
  }
}
```

- **要件 ↔ タスク・テスト**: `requirements.md` の完了条件を `AC-1:` のような ID 付きで書くと、
  `tasks.md` / `test.md` から参照されていない受け入れ条件を検出します。

いずれも情報提供であり、総合スコアには算入されません。また `session end` 時には、セッションの
`design.md` に書いた恒久的な設計判断を `docs/architecture.md` 等へ昇格するようリマインドします。

## MCP Server として使う

Claude Code 等の MCP クライアントに登録すると、AIエージェントが doctor / session / workflow / update をツールとして直接呼べます:

```bash
claude mcp add foundruu -- npx foundruu mcp
```

公開ツール: `doctor` / `doctor_deep` / `session_start` / `session_list` / `workflow_install` / `update`

## プラグイン

`foundruu-plugin-*` という名前の npm パッケージを入れる(または `foundruu.json` の `plugins` にパスを書く)と自動で読み込まれ、コマンドと doctor チェックを拡張できます:

```js
// foundruu-plugin-security/index.js
module.exports = {
  name: "security",
  register({ program, addDoctorCheck, log }) {
    addDoctorCheck({
      id: "security-md",
      label: "SECURITY.md",
      category: "セキュリティ",
      severity: "warn",
      hint: "SECURITY.md を追加してください",
      check: (ctx) => ctx.exists("SECURITY.md"),
    });
    program.command("audit").action(() => log.success("audit 実行"));
  },
};
```

書き方・ローカル開発・npm 公開までは [docs/PLUGIN_DEV.md](docs/PLUGIN_DEV.md) を参照してください。

### 公式プラグイン

- [foundruu-plugin-security](plugins/foundruu-plugin-security/) — SECURITY.md / .env の gitignore / 依存更新自動化のチェックを追加（`npm i -D foundruu-plugin-security`）。自作プラグインの参考実装でもあります
- [foundruu-plugin-node](plugins/foundruu-plugin-node/) — Node バージョン固定 / ロックファイル / node_modules の gitignore のチェックを追加（`npm i -D foundruu-plugin-node`）

## ダッシュボード

`doctor --deep --report reports` で溜めたレポートから、スコア推移を可視化できます:

```bash
foundruu dashboard                        # reports/index.html を生成
foundruu dashboard --dir out --out d.html # 入力ディレクトリ・出力先を指定
```

## Cloud（レポート集約）

複数プロジェクトのレポートを [foundruu-cloud](https://github.com/Ruu5LP/foundruu-cloud) に集約し、
[公開ダッシュボード](https://ruu5lp.github.io/foundruu-cloud/)で俯瞰できます:

```bash
foundruu doctor --deep --report reports
foundruu cloud push    # 認証は gh auth token / GH_TOKEN
```

設計は [docs/cloud.md](docs/cloud.md) を参照。

## GitHub Actions として使う

他リポジトリの PR チェックとして doctor を実行できます:

```yaml
jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Ruu5LP/foundruu@v0.12.0 # リリースタグに固定（移動タグ v0 でも可）
        with:
          fail-on: error # error / warning / never
          deep: "true" # --deep のスコア診断も実行
          pr-comment: "true" # deep の結果を PR コメントとして投稿(要 pull-requests: write)
```

`pr-comment: "true"` にすると、deep スコアとトレーサビリティ結果が PR コメントとして
投稿されます（同じ PR では既存コメントを更新し、積み上げません）。ジョブに
`permissions: pull-requests: write` が必要です。

結果はジョブサマリに表形式で出力されます。依存ごとバンドル済みのため、実行時に
npm install や TypeScript ビルドは走りません(`node` で即実行)。`@main` ではなく
リリースタグ(`@v0.12.0` など)への固定を推奨します。

## VSCode Extension

[vscode-extension/](vscode-extension/) にコマンドパレット連携の拡張があります（Doctor / セッション作成 / Workflow 導入・更新）。
`npx @vscode/vsce package` で .vsix を生成してインストールできます。

## 開発

```bash
npm run dev -- doctor   # tsx で実行
npm test                # vitest
npm run test:coverage   # カバレッジ計測（coverage/ に HTML/lcov 出力）
npm run typecheck
npm run lint            # ESLint（--fix で自動修正）
npm run format          # Prettier で整形（format:check は差分チェックのみ）
```

lint / format:check / typecheck / test:coverage / build は CI（[.github/workflows/ci.yml](.github/workflows/ci.yml)）でも実行されます。
カバレッジは回帰防止の下限しきい値を設定しており（[vitest.config.ts](vitest.config.ts)）、下回ると CI が失敗します。

## ドキュメント

- [docs/investigation.md](docs/investigation.md) — 3リポジトリの調査結果
- [docs/architecture.md](docs/architecture.md) — 全体アーキテクチャ・設計判断
- [docs/roadmap.md](docs/roadmap.md) — MVP以降のロードマップ
- [docs/PLUGIN_DEV.md](docs/PLUGIN_DEV.md) — プラグイン開発ガイド
- [docs/cloud.md](docs/cloud.md) — Cloud(レポート集約)の設計
- [CHANGELOG.md](CHANGELOG.md) — 変更履歴

## ライセンス

MIT
