import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { renderOnboarding } from "../src/commands/onboard";

let tmp: string;

const write = (rel: string, content: string) => {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-onboard-")));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("renderOnboarding", () => {
  it("プロジェクト名・ルール・ワークフロー・セッション・doctor 結果を含む", () => {
    write("package.json", JSON.stringify({ name: "my-app", description: "テストアプリ" }));
    write("CLAUDE.md", "# ルール");
    write(".ai/rules/review-feedback.md", "# 規約");
    write(".ai/workflows/feature.md", "# 手順");
    write(".ai/prompts/session-workflow.md", "# フロー");
    write(".ai/sessions/.current", "feat-x\n");
    fs.mkdirSync(path.join(tmp, ".ai/sessions/feat-x"), { recursive: true });
    write(".ai/sessions/.status/feat-x.json", JSON.stringify({ startedAt: "2026-01-01" }));

    const md = renderOnboarding(tmp);
    expect(md).toContain("# my-app オンボーディング");
    expect(md).toContain("テストアプリ");
    expect(md).toContain("- CLAUDE.md");
    expect(md).toContain("- .ai/rules/review-feedback.md");
    expect(md).toContain(".ai/workflows/feature.md");
    expect(md).toContain(".ai/prompts/session-workflow.md");
    expect(md).toContain("- feat-x: 進行中（現在のセッション）");
    expect(md).toContain("## リポジトリの健全性 (doctor)");
  });

  it("何も無いリポジトリでも導入ガイド付きで生成される", () => {
    const md = renderOnboarding(tmp);
    expect(md).toContain(`# ${path.basename(tmp)} オンボーディング`);
    expect(md).toContain("AI ルールが見つかりません");
    expect(md).toContain("セッションはまだありません");
    expect(md).toContain("fail");
  });

  it("導入状況: 未導入コンポーネントは ✖ と導入ヒント付きで列挙される (AC-1, AC-2)", () => {
    const md = renderOnboarding(tmp);
    expect(md).toContain("## 導入状況");
    expect(md).toContain("- ✖ CLI: 未導入（導入: `npm i -D foundruu`）");
    expect(md).toContain("- ✖ GitHub Action: 未導入");
    expect(md).toContain("- ✖ MCP サーバー: 未登録");
    expect(md).toContain("- ✖ pre-commit フック: 未導入（導入: `foundruu hooks install`）");
  });

  it("導入状況: devDependencies / workflow / .mcp.json を検出して ✔ で表示する (AC-1)", () => {
    write(
      "package.json",
      JSON.stringify({ name: "my-app", devDependencies: { foundruu: "^0.13.0" } })
    );
    write(".github/workflows/ci.yml", "uses: Ruu5LP/foundruu@v1\n");
    write(
      ".mcp.json",
      JSON.stringify({ mcpServers: { foundruu: { command: "npx", args: ["foundruu", "mcp"] } } })
    );

    const md = renderOnboarding(tmp);
    expect(md).toContain("- ✔ CLI: ^0.13.0（devDependencies）");
    expect(md).toContain("- ✔ GitHub Action: 組み込み済み（ci.yml）");
    expect(md).toContain("- ✔ MCP サーバー: .mcp.json に登録済み");
  });

  it("導入状況: 本体リポジトリでは CLI が開発版として表示される (AC-3)", () => {
    write("package.json", JSON.stringify({ name: "foundruu" }));
    const md = renderOnboarding(tmp);
    expect(md).toContain("- ✔ CLI: 本体リポジトリ（開発版）");
  });

  it("doctor の fail / warn 項目は hint 付きで列挙される", () => {
    const md = renderOnboarding(tmp);
    expect(md).toMatch(/✖ README: /);
  });
});
