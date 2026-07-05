/**
 * workflow install(installWorkflow)のテスト。
 *
 * 既存リポジトリへ .ai/(Workflow / Prompt / Rules)を導入する中核。同梱アセットを
 * 使った統合テストとして検証する:
 *   - 同梱の .ai/ ファイル一式が cwd に書き込まれる
 *   - 導入時ハッシュを foundruu.json の workflow.files に記録する(update の編集検出用)
 *   - .gitignore に .ai/sessions/ を追加し、二度目は重複させない(冪等)
 *   - overwrite=false では既存ファイルを壊さない
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { installWorkflow } from "../src/commands/workflow";
import { readConfig } from "../src/core/config";

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-wf-"));
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe("installWorkflow", () => {
  it("同梱の .ai/ ファイルを書き込み、foundruu.json にハッシュを記録する", () => {
    installWorkflow(cwd);
    expect(fs.existsSync(path.join(cwd, ".ai/prompts/session-workflow.md"))).toBe(true);
    const config = readConfig(cwd);
    expect(config?.workflow?.files).toBeDefined();
    expect(Object.keys(config!.workflow!.files!).length).toBeGreaterThan(0);
  });

  it(".gitignore に .ai/sessions/ を追加し、二度目は重複させない", () => {
    installWorkflow(cwd);
    installWorkflow(cwd);
    const gitignore = fs.readFileSync(path.join(cwd, ".gitignore"), "utf8");
    const hits = gitignore.split(/\r?\n/).filter((l) => l === ".ai/sessions/");
    expect(hits.length).toBe(1);
  });

  it("overwrite=false では既存のユーザー編集を保持する", () => {
    const target = path.join(cwd, ".ai/prompts/session-workflow.md");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "USER EDIT");
    installWorkflow(cwd, { overwrite: false });
    expect(fs.readFileSync(target, "utf8")).toBe("USER EDIT");
  });
});
