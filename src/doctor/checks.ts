import fs from "fs";
import path from "path";
import { DoctorCheck } from "./types";

/** package.json の name か、無ければディレクトリ名をプロジェクト名として使う */
function projectName(cwd: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as {
      name?: string;
    };
    if (pkg.name) return pkg.name;
  } catch {
    /* package.json が無い/壊れている場合はディレクトリ名にフォールバック */
  }
  return path.basename(cwd);
}

/** cwd/rel にファイルを作成し、実施メッセージを返す(fix は欠如時のみ呼ばれる) */
function create(cwd: string, rel: string, content: string): string {
  fs.writeFileSync(path.join(cwd, rel), content);
  return `${rel} を作成しました`;
}

const MIT_LICENSE = (year: number) => `MIT License

Copyright (c) ${year} <COPYRIGHT HOLDER>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/**
 * 診断ルール定義。チェックの追加はこの配列に1エントリ足すだけでよい。
 * `fix` を持つチェックは `doctor --fix` で自動生成できる(既存は上書きしない)。
 */
export const checks: DoctorCheck[] = [
  {
    id: "readme",
    label: "README",
    category: "ドキュメント",
    severity: "error",
    hint: "README.md を作成し、プロジェクトの目的・セットアップ手順を書いてください",
    check: (ctx) => ctx.existsAny(["README.md", "README"]),
    fix: (ctx) =>
      create(
        ctx.cwd,
        "README.md",
        `# ${projectName(ctx.cwd)}\n\n> TODO: プロジェクトの目的とセットアップ手順を記述してください。\n`
      ),
  },
  {
    id: "license",
    label: "LICENSE",
    category: "ドキュメント",
    severity: "warn",
    hint: "LICENSE ファイルを追加してください",
    check: (ctx) => ctx.existsAny(["LICENSE", "LICENSE.md", "LICENSE.txt"]),
    fix: (ctx) => create(ctx.cwd, "LICENSE", MIT_LICENSE(new Date().getFullYear())),
  },
  {
    id: "gitignore",
    label: ".gitignore",
    category: "リポジトリ設定",
    severity: "error",
    hint: ".gitignore を作成してください（foundruu init で導入できます）",
    check: (ctx) => ctx.exists(".gitignore"),
    fix: (ctx) => create(ctx.cwd, ".gitignore", "node_modules/\ndist/\n.env\n*.log\n"),
  },
  {
    id: "env-example",
    label: ".env.example",
    category: "リポジトリ設定",
    severity: "warn",
    hint: ".env.example を作成し、必要な環境変数の一覧を共有してください",
    check: (ctx) => ctx.existsAny([".env.example", ".env.sample"]),
    fix: (ctx) =>
      create(
        ctx.cwd,
        ".env.example",
        "# 必要な環境変数のキーと説明のみを記載してください（値は書かない）\n# 例:\n# DATABASE_URL=\n"
      ),
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
      ctx.existsAny([
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
      ]),
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
    id: "session-requirements",
    label: "進行中セッションの要件",
    category: "AI開発",
    severity: "warn",
    hint: "進行中セッションの requirements.md が未記入です。実装を始める前に要件を書いてください",
    check: (ctx) => {
      // 進行中セッションが無ければ対象外(pass)。あるのに要件が空なら「要件なしで実装が進む」兆候
      const currentFile = path.join(ctx.cwd, ".ai", "sessions", ".current");
      if (!fs.existsSync(currentFile)) return true;
      const name = fs.readFileSync(currentFile, "utf8").trim();
      if (!name) return true;
      const requirements = path.join(ctx.cwd, ".ai", "sessions", name, "requirements.md");
      if (!fs.existsSync(requirements)) return false;
      return fs.readFileSync(requirements, "utf8").trim().length > 0;
    },
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
