/**
 * workflow install(installWorkflow)のテスト。
 *
 * 既存リポジトリへ .ai/(Workflow / Prompt / Rules)を導入する中核。同梱アセットを
 * 使った統合テストとして検証する:
 *   - 同梱の .ai/ ファイル一式が cwd に書き込まれる
 *   - 導入時ハッシュを foundruu.json の workflow.files に記録する(update の編集検出用)
 *   - .gitignore に .ai/sessions/ を追加し、二度目は重複させない(冪等)
 *   - Prettier 使用時は .prettierignore に .ai を追加する(update のハッシュ誤検知回避)
 *   - Prettier 未使用時は .prettierignore を作らない
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

  it("Prettier 使用時は .prettierignore に .ai を追加し、二度目は重複させない", () => {
    fs.writeFileSync(path.join(cwd, ".prettierrc"), "{}");
    installWorkflow(cwd);
    installWorkflow(cwd);
    const ignore = fs.readFileSync(path.join(cwd, ".prettierignore"), "utf8");
    const hits = ignore.split(/\r?\n/).filter((l) => l === ".ai");
    expect(hits.length).toBe(1);
  });

  it("package.json の prettier キーだけでも .prettierignore に .ai を追加する", () => {
    fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ prettier: {} }));
    installWorkflow(cwd);
    const ignore = fs.readFileSync(path.join(cwd, ".prettierignore"), "utf8");
    expect(ignore.split(/\r?\n/)).toContain(".ai");
  });

  it("既に .ai/ が無視されていれば .ai を二重登録しない", () => {
    fs.writeFileSync(path.join(cwd, ".prettierrc"), "{}");
    fs.writeFileSync(path.join(cwd, ".prettierignore"), "dist/\n.ai/\n");
    installWorkflow(cwd);
    const lines = fs
      .readFileSync(path.join(cwd, ".prettierignore"), "utf8")
      .split(/\r?\n/)
      .filter((l) => l === ".ai" || l === ".ai/");
    expect(lines).toEqual([".ai/"]);
  });

  it("Prettier 未使用時は .prettierignore を作らない", () => {
    installWorkflow(cwd);
    expect(fs.existsSync(path.join(cwd, ".prettierignore"))).toBe(false);
  });

  it("overwrite=false では既存のユーザー編集を保持する", () => {
    const target = path.join(cwd, ".ai/prompts/session-workflow.md");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "USER EDIT");
    installWorkflow(cwd, { overwrite: false });
    expect(fs.readFileSync(target, "utf8")).toBe("USER EDIT");
  });
});
