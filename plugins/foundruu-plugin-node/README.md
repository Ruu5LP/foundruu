# foundruu-plugin-node

[FoundRuu](https://github.com/Ruu5LP/foundruu) の公式プラグインです。
`foundruu doctor` に Node.js プロジェクトの再現性・衛生チェックを追加します。

## インストール

```bash
npm install -D foundruu-plugin-node
```

プロジェクトの `node_modules` に入っていれば自動で読み込まれます（設定不要）。

## 追加されるチェック

| チェック | severity | 内容 |
| --- | --- | --- |
| Node バージョンの固定 | warn | `.nvmrc` / `.node-version` または `engines.node` |
| ロックファイルのコミット | warn | `package-lock.json` 等の存在 |
| node_modules が gitignore されている | error | 依存のコミット防止 |

## プラグインを自作する

このパッケージの [index.js](index.js) が参考実装です。書き方は
[docs/PLUGIN_DEV.md](https://github.com/Ruu5LP/foundruu/blob/main/docs/PLUGIN_DEV.md) を参照してください。
