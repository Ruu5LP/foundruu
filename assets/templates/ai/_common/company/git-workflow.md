# Git ワークフロー

## ブランチ戦略

```
main        ← 本番リリース済み
develop     ← 開発統合
feature/*   ← 機能開発
fix/*       ← バグ修正
chore/*     ← 依存更新・設定変更
```

## コミットメッセージ規約（Conventional Commits）

```
<type>(<scope>): <subject>

type:
  feat     新機能
  fix      バグ修正
  docs     ドキュメントのみ
  style    フォーマット（動作変更なし）
  refactor リファクタリング
  test     テスト追加・修正
  chore    ビルド・補助ツール変更
```

例:
```
feat(auth): add JWT refresh token support
fix(api): handle null response from external API
docs(readme): update setup instructions
```

## PR ルール

- 1 PR = 1 つの目的に絞る
- レビュー前に自己レビューを行う
- CI が通っていることを確認してからレビュー依頼する
- マージは Squash merge を使用する
