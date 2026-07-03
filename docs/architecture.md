# FoundRuu CLI アーキテクチャ

## 全体像

FoundRuu CLI は「テンプレート導入 (init)」「Workflow 導入 (workflow)」「診断 (doctor)」「更新 (update)」の4機能を持つ TypeScript 製 CLI。3つの既存リポジトリの資産を `assets/` に統合して同梱する。

```
foundruu init              テンプレート + Workflow + Rules + Doctor設定を一括導入
foundruu workflow install  Workflow / Prompt / Rules のみ導入
foundruu doctor            リポジトリ健全性診断
foundruu update            同梱アセットを最新へ再配置
```

## ディレクトリ構成

```
foundruu/
├── src/
│   ├── cli.ts                 # エントリポイント (commander)
│   ├── commands/              # 1コマンド = 1ファイル
│   │   ├── init.ts
│   │   ├── workflow.ts
│   │   ├── doctor.ts
│   │   └── update.ts
│   ├── core/
│   │   ├── assets.ts          # 同梱アセットのパス解決
│   │   ├── config.ts          # foundruu.json の読み書き
│   │   ├── copier.ts          # テンプレートコピー + Handlebars レンダリング
│   │   └── logger.ts          # 出力整形
│   ├── doctor/
│   │   ├── types.ts           # DoctorCheck インターフェース
│   │   ├── checks.ts          # 宣言的チェックルール定義（追加はここに1エントリ足すだけ）
│   │   └── runner.ts          # チェック実行 + 集計
│   └── registry/
│       └── templates.ts       # テンプレートレジストリ
├── assets/                    # 3リポジトリから統合した資産（パッケージに同梱）
│   ├── templates/             # ← dev-init-templates
│   │   ├── base/  languages/  features/  ai/
│   └── workflow/              # ← dev-workflow (.ai/) + 新設 workflows
│       └── .ai/
│           ├── prompts/session-workflow.md
│           ├── workflows/     # development / feature / bugfix / review
│           └── templates/session/
├── tests/                     # vitest
└── docs/                      # investigation / architecture / roadmap
```

## 設計判断

### 設定ファイル: `foundruu.json`
導入先プロジェクトのルートに生成。update の差分・バージョン管理の基盤。
```json
{
  "version": "0.1.0",
  "template": "typescript",
  "installedAt": "...",
  "workflow": { "version": "0.1.0", "installedAt": "..." }
}
```

### Template 管理
- `src/registry/templates.ts` にテンプレートを宣言的に登録（id / label / language / features / status）
- `available` 以外のテンプレート（laravel-react 等）は `planned` として登録し、指定時に案内を出す
- 合成順: `base` → `languages/<lang>` → `features/*`（テンプレート定義に従う）→ `ai/`
- `.hbs` は Handlebars レンダリング、`package.json.patch` はディープマージ、他はコピー

### Doctor 管理
- `DoctorCheck = { id, label, category, severity, check(ctx) }` の配列
- チェック追加 = `checks.ts` に 1 エントリ追加のみ
- MVP チェック: README / LICENSE / .gitignore / .env.example / package.json|composer.json / Docker / GitHub Actions / AI Rules / Workflow / Prompt
- 結果: pass / warn / fail + 修正コマンドの提案（例: `foundruu workflow install`）
- `--json` で機械可読出力（GitHub Actions 連携用）

### Update 方法
- MVP: CLI 同梱アセットのバージョンと `foundruu.json` を比較し、workflow アセットを再配置（`--force` で無条件上書き）
- 将来: degit で GitHub から最新を取得 → ローカルキャッシュ → 差分表示 → 選択適用。
  `foundruu.json` にバージョンとハッシュを記録する前提の構造にしてあるため互換のまま拡張可能

### 拡張ポイント（将来）
- **Plugin**: commander のサブコマンド登録を `commands/` の配列駆動にしており、`foundruu-plugin-*` パッケージの動的ロードを差し込める
- **npm 公開**: `bin` / `files` / `prepublishOnly` 設定済み。`npx foundruu` で利用可能
- **GitHub Actions**: `foundruu doctor --json` の exit code / JSON 出力を CI で消費
- **VSCode Extension / MCP Server**: `src/commands` はロジックを `core` / `doctor` に委譲しているため、同じ関数を Extension / MCP から呼べる

## 技術スタック

| 項目 | 選定 |
|---|---|
| 言語 | TypeScript (strict) |
| ランタイム | Node.js >= 20 (LTS) |
| CLI | commander |
| テンプレート | handlebars |
| テスト | vitest |
| ビルド | tsc + assets コピー |
