# FoundRuu Cloud 設計

## 目的

複数プロジェクトの `doctor --deep` レポートを一箇所に集約し、
チーム全体の AI開発品質をダッシュボードで俯瞰できるようにする。

## 方針: GitHub をバックエンドにする

専用サーバーを立てず、GitHub リポジトリ + GitHub Pages で構成する。

- **認証** — 既存の GitHub 認証（`gh` CLI / `GH_TOKEN`）をそのまま使う。ユーザー管理不要
- **保存** — レポートはただの JSON。リポジトリ履歴がそのまま監査ログになる
- **公開** — GitHub Pages で静的ダッシュボードを自動ビルド
- **コスト** — 無料。将来レポートが増えたら本物のサービスに移行できる（CLI 側は push 先の差し替えのみ）

```
各プロジェクト                     Ruu5LP/foundruu-cloud
┌──────────────────┐   cloud push   ┌─────────────────────────┐
│ doctor --deep     │ ────────────▶ │ reports/<project>/<ts>.json │
│   --report reports│  (GitHub API)  │   └─ push で Pages を再ビルド │
└──────────────────┘                │ site/ → GitHub Pages        │
                                    └─────────────────────────┘
```

## CLI

```bash
foundruu doctor --deep --report reports   # レポート生成
foundruu cloud push                       # 最新レポートを送信
```

- 送信先はデフォルト `Ruu5LP/foundruu-cloud`。`foundruu.json` の `cloud.repo` または `--repo` で変更可能
- 認証は `gh auth token` → `GH_TOKEN` / `GITHUB_TOKEN` の順で解決
- 送信内容: `reports/<プロジェクト名>/<タイムスタンプ>.json`（Contents API の PUT、1コミット/レポート）

## ダッシュボード（foundruu-cloud 側）

- push をトリガーに GitHub Actions が `npx foundruu dashboard` をプロジェクトごとに実行し、
  `site/<project>.html` と一覧 `site/index.html` を生成して Pages にデプロイ
- CLI 側の `dashboard` コマンドをそのまま再利用する（ロジックの二重管理をしない）

## 将来の拡張

- 組織用: `cloud.repo` を組織のプライベートリポジトリに向けるだけ
- 本物の Cloud サービス化: CLI の push 先を HTTPS エンドポイントに差し替え(認証は PAT → OIDC)
- Marketplace: プラグイン一覧ページを同じ Pages に同居
