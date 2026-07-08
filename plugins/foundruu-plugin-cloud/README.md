# foundruu-plugin-cloud

[FoundRuu](https://github.com/Ruu5LP/foundruu) の公式プラグインです。
`foundruu doctor --deep` のレポートを可視化・集約する計測系コマンドを追加します。

FoundRuu 本体は「ドキュメントと品質の番人」に絞る方針のため、
計測・集約系の機能はこのプラグインに分離されています。

## インストール

```bash
npm install -D foundruu-plugin-cloud
```

プロジェクトの `node_modules` に入っていれば自動で読み込まれます（設定不要）。

## 追加されるコマンド

| コマンド | 内容 |
|---|---|
| `foundruu dashboard` | レポート履歴からスコア推移ダッシュボード(HTML)を生成 |
| `foundruu cloud push` | 最新の deep レポートを Cloud リポジトリへ送信 |

## 利用フロー

```bash
foundruu doctor --deep --report reports   # レポート生成(本体)
foundruu dashboard                        # reports/index.html を生成
foundruu cloud push                       # foundruu-cloud へ送信
```

- 送信先はデフォルト `Ruu5LP/foundruu-cloud`。`foundruu.json` の `cloud.repo` または `--repo` で変更可能
- 認証は `GH_TOKEN` / `GITHUB_TOKEN` → `gh auth token` の順で解決

詳細な設計は本体リポジトリの [docs/cloud.md](https://github.com/Ruu5LP/foundruu/blob/main/docs/cloud.md) を参照してください。
