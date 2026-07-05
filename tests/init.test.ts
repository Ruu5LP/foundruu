/**
 * init コマンドの resolveFeatures のテスト。
 *
 * resolveFeatures は `--features docker,vitest` のようなユーザー入力を
 * パース・検証する純関数で、init の入口。ここで不正な feature を弾けないと
 * 後段のテンプレート展開で不明なフラグが素通りしてしまう。そのため:
 *   - 未指定(undefined)はテンプレートのデフォルトをそのまま使う
 *   - カンマ区切りをパースし、前後の空白を落とす
 *   - 空文字は空配列(=feature なし)
 *   - 未知の feature はエラーにして利用可能一覧を提示する
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveFeatures, runInit } from "../src/commands/init";
import { readConfig } from "../src/core/config";

describe("resolveFeatures", () => {
  it("未指定のときはテンプレートのデフォルトをそのまま返す", () => {
    const defaults = ["docker", "vitest"];
    expect(resolveFeatures(undefined, defaults)).toBe(defaults);
  });

  it("カンマ区切りをパースし前後の空白を落とす", () => {
    expect(resolveFeatures(" docker , vitest ", [])).toEqual(["docker", "vitest"]);
  });

  it("空文字は空配列(feature なし)になる", () => {
    expect(resolveFeatures("", ["docker"])).toEqual([]);
  });

  it("未知の feature はエラーにし、利用可能一覧を示す", () => {
    expect(() => resolveFeatures("docker,bogus", [])).toThrowError(/bogus/);
    expect(() => resolveFeatures("bogus", [])).toThrowError(/利用可能/);
  });

  it("既知の feature のみなら検証を通過する", () => {
    expect(resolveFeatures("eslint,prettier", ["docker"])).toEqual(["eslint", "prettier"]);
  });
});

/**
 * runInit の非対話テスト(--template + --yes)。TTY でない実行では promptMissing が
 * そのまま素通りするため、対話モックなしで本体(テンプレート合成 → workflow 導入 →
 * foundruu.json 記録)を実アセットで検証できる。
 */
describe("runInit(非対話)", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-init-"));
  });
  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("テンプレートを展開し、workflow 導入と foundruu.json 記録まで行う", async () => {
    await runInit(cwd, { template: "typescript", name: "my-app", yes: true });

    const config = readConfig(cwd);
    expect(config?.template).toBe("typescript");
    expect(config?.projectName).toBe("my-app");
    expect(config?.workflow).toBeDefined(); // installWorkflow まで走っている
    // テンプレート由来のファイルと .ai/ の両方が書き込まれている
    expect(fs.existsSync(path.join(cwd, ".ai/prompts/session-workflow.md"))).toBe(true);
  });

  it("存在しないテンプレートはエラーにする", async () => {
    await expect(runInit(cwd, { template: "no-such", yes: true })).rejects.toThrow(/存在しません/);
  });
});
