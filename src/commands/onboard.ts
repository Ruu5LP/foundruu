import fs from "fs";
import path from "path";
import { runDoctor } from "../doctor/runner";
import { findAiRoot, readCurrent, readStatus } from "../core/session-store";
import { sessionNames } from "./session";

/**
 * オンボーディング: 新しいメンバー(人・AI)が「このリポジトリのルール・ワークフロー・
 * 現在の状態」を1コマンドで把握できる Markdown サマリを生成する。
 * AI エージェントには MCP の onboard ツール経由でそのままコンテキストとして渡せる。
 */

function listMd(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function readProjectInfo(cwd: string): { name: string; description?: string } {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as {
      name?: string;
      description?: string;
    };
    if (pkg.name) return { name: pkg.name, description: pkg.description };
  } catch {
    /* package.json が無ければディレクトリ名を使う */
  }
  return { name: path.basename(cwd) };
}

/** リポジトリのオンボーディングサマリ(Markdown)を生成する */
export function renderOnboarding(cwd: string): string {
  const root = findAiRoot(cwd) ?? cwd;
  const project = readProjectInfo(root);
  const lines: string[] = [
    `# ${project.name} オンボーディング`,
    "",
    ...(project.description ? [project.description, ""] : []),
  ];

  // AI ルール: エージェントが最初に読むべきファイル
  const ruleFiles = ["CLAUDE.md", "CODEX.md", "AGENTS.md"].filter((f) =>
    fs.existsSync(path.join(root, f))
  );
  const aiRules = listMd(path.join(root, ".ai", "rules"));
  lines.push("## 最初に読むべきルール", "");
  if (ruleFiles.length === 0 && aiRules.length === 0) {
    lines.push("- （AI ルールが見つかりません。`foundruu init` で導入できます）");
  } else {
    lines.push(...ruleFiles.map((f) => `- ${f}`));
    lines.push(...aiRules.map((f) => `- .ai/rules/${f}`));
  }
  lines.push("");

  // ワークフロー・プロンプト: 作業の進め方
  const workflows = listMd(path.join(root, ".ai", "workflows"));
  const prompts = listMd(path.join(root, ".ai", "prompts"));
  if (workflows.length > 0 || prompts.length > 0) {
    lines.push("## 作業の進め方", "");
    if (prompts.includes("session-workflow.md")) {
      lines.push("- 作業フロー: .ai/prompts/session-workflow.md（セッション駆動開発の手順）");
    }
    lines.push(...workflows.map((f) => `- ワークフロー: .ai/workflows/${f}`));
    lines.push(
      ...prompts
        .filter((f) => f !== "session-workflow.md")
        .map((f) => `- プロンプト: .ai/prompts/${f}`)
    );
    lines.push("");
  }

  // セッション: いま何が進んでいるか
  lines.push("## セッションの状態", "");
  let sessions: string[] = [];
  try {
    sessions = sessionNames(root);
  } catch {
    /* .ai が無ければセッションなしとして扱う */
  }
  if (sessions.length === 0) {
    lines.push("- セッションはまだありません（作成: `foundruu session start <name>`）");
  } else {
    const current = readCurrent(root);
    for (const name of sessions) {
      const ended = readStatus(root, name)?.endedAt;
      const state = ended ? "完了" : "進行中";
      const marker = name === current ? "（現在のセッション）" : "";
      lines.push(`- ${name}: ${state}${marker}`);
    }
  }
  lines.push("");

  // doctor: リポジトリの健全性と要対応事項
  const report = runDoctor(root);
  lines.push(
    "## リポジトリの健全性 (doctor)",
    "",
    `- 結果: ${report.passed} pass / ${report.warned} warn / ${report.failed} fail`
  );
  for (const r of report.results) {
    if (r.status === "pass") continue;
    lines.push(`- ${r.status === "fail" ? "✖" : "⚠"} ${r.label}: ${r.hint ?? ""}`);
  }
  lines.push("");

  lines.push(
    "## 次のステップ",
    "",
    "1. 上記ルールとワークフローを読む",
    "2. 進行中セッションがあれば requirements.md / design.md から文脈を把握する",
    "3. 新しい作業は `foundruu session start <name>` で要件から始める",
    ""
  );
  return lines.join("\n");
}

/** onboard コマンド本体。AI にパイプで渡せる装飾なし Markdown を標準出力へ流す */
export function runOnboard(cwd: string): void {
  // AI にパイプで渡せるよう、装飾なしの Markdown を標準出力へ流す
  console.log(renderOnboarding(cwd));
}
