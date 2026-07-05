/**
 * update(runUpdate)のテスト。
 *
 * 導入済み Workflow を最新アセットへ同期する。オフライン/決定論のため
 * local:true(同梱アセット)で検証する:
 *   - 未導入なら警告し exitCode=1 で止まる(何も同期しない)
 *   - 導入直後は同梱と一致するため「すべて最新」で終わる
 *   - --diff(dryRun)は foundruu.json を書き換えない
 * install 直後の状態づくりには実物の installWorkflow を使う(両者は密結合のため)。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runUpdate } from "../src/commands/update";
import { installWorkflow } from "../src/commands/workflow";
import { readConfig } from "../src/core/config";

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-update-"));
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
  process.exitCode = 0; // runUpdate が立てた exitCode を持ち越さない
});

describe("runUpdate", () => {
  it("Workflow 未導入なら警告し exitCode=1 で止まる", () => {
    runUpdate(cwd, { local: true });
    expect(process.exitCode).toBe(1);
    expect(readConfig(cwd)).toBeNull();
  });

  it("導入直後は同梱と一致するため何も変更しない", () => {
    installWorkflow(cwd);
    const before = fs.readFileSync(path.join(cwd, "foundruu.json"), "utf8");
    runUpdate(cwd, { local: true });
    // すべて最新 → 早期 return で config を書き換えない
    expect(fs.readFileSync(path.join(cwd, "foundruu.json"), "utf8")).toBe(before);
  });

  it("--diff は書き込まない(dryRun)", () => {
    installWorkflow(cwd);
    // ユーザー編集を作って差分を発生させる
    const target = path.join(cwd, ".ai/prompts/session-workflow.md");
    fs.writeFileSync(target, "USER EDIT");
    const before = fs.readFileSync(path.join(cwd, "foundruu.json"), "utf8");

    runUpdate(cwd, { local: true, diff: true });

    expect(fs.readFileSync(target, "utf8")).toBe("USER EDIT"); // 編集は残る
    expect(fs.readFileSync(path.join(cwd, "foundruu.json"), "utf8")).toBe(before); // config 不変
  });
});
