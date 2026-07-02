import { DoctorCheck } from "./types";

/**
 * 診断ルール定義。チェックの追加はこの配列に1エントリ足すだけでよい。
 */
export const checks: DoctorCheck[] = [
  {
    id: "readme",
    label: "README",
    category: "ドキュメント",
    severity: "error",
    hint: "README.md を作成し、プロジェクトの目的・セットアップ手順を書いてください",
    check: (ctx) => ctx.existsAny(["README.md", "README"]),
  },
  {
    id: "license",
    label: "LICENSE",
    category: "ドキュメント",
    severity: "warn",
    hint: "LICENSE ファイルを追加してください",
    check: (ctx) => ctx.existsAny(["LICENSE", "LICENSE.md", "LICENSE.txt"]),
  },
  {
    id: "gitignore",
    label: ".gitignore",
    category: "リポジトリ設定",
    severity: "error",
    hint: ".gitignore を作成してください（foundruu init で導入できます）",
    check: (ctx) => ctx.exists(".gitignore"),
  },
  {
    id: "env-example",
    label: ".env.example",
    category: "リポジトリ設定",
    severity: "warn",
    hint: ".env.example を作成し、必要な環境変数の一覧を共有してください",
    check: (ctx) => ctx.existsAny([".env.example", ".env.sample"]),
  },
  {
    id: "package-manifest",
    label: "package.json / composer.json",
    category: "リポジトリ設定",
    severity: "warn",
    hint: "package.json（Node.js）または composer.json（PHP）が見つかりません",
    check: (ctx) => ctx.existsAny(["package.json", "composer.json"]),
  },
  {
    id: "docker",
    label: "Docker",
    category: "実行環境",
    severity: "warn",
    hint: "Dockerfile または docker-compose.yml を追加すると環境を再現しやすくなります",
    check: (ctx) =>
      ctx.existsAny(["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]),
  },
  {
    id: "github-actions",
    label: "GitHub Actions",
    category: "CI/CD",
    severity: "warn",
    hint: ".github/workflows/ に CI ワークフローを追加してください",
    check: (ctx) => ctx.exists(".github/workflows"),
  },
  {
    id: "ai-rules",
    label: "AI Rules",
    category: "AI開発",
    severity: "error",
    hint: "CLAUDE.md / CODEX.md / .ai/rules がありません（foundruu init で導入できます）",
    check: (ctx) => ctx.existsAny(["CLAUDE.md", "CODEX.md", "AGENTS.md", ".ai/rules", "docs/ai"]),
  },
  {
    id: "workflow",
    label: "Workflow",
    category: "AI開発",
    severity: "error",
    hint: ".ai/workflows がありません（foundruu workflow install で導入できます）",
    check: (ctx) => ctx.exists(".ai/workflows"),
  },
  {
    id: "prompt",
    label: "Prompt",
    category: "AI開発",
    severity: "error",
    hint: ".ai/prompts がありません（foundruu workflow install で導入できます）",
    check: (ctx) => ctx.exists(".ai/prompts"),
  },
  {
    id: "foundruu-config",
    label: "FoundRuu 設定 (foundruu.json)",
    category: "AI開発",
    severity: "warn",
    hint: "foundruu.json がありません（foundruu init / workflow install で生成されます）",
    check: (ctx) => ctx.exists("foundruu.json"),
  },
];
