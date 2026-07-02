# コーディング規約

## 基本方針

- 読みやすさを最優先にする
- 一貫性を保つ（既存のスタイルに合わせる）
- 不要なコメントは書かない（コードで意図を伝える）
- マジックナンバーは定数として定義する

## 命名規則

### TypeScript / JavaScript
- 変数・関数: `camelCase`
- クラス・型・インターフェース: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`
- ファイル名: `kebab-case.ts`

### Python
- 変数・関数: `snake_case`
- クラス: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`
- ファイル名: `snake_case.py`

## エラーハンドリング

- エラーは適切な型で throw/raise する
- エラーメッセージは英語で記述する
- 握り潰しは絶対に禁止（空の catch は NG）

## セキュリティ

- シークレットは必ず環境変数で管理する
- `.env` をコミットしない（`.env.example` のみ）
- SQL インジェクション・XSS に注意する
- 詳細は [security.md](./security.md) を参照
