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

  it("既存プロジェクトへの後入れでは package.json の既存値を維持する", async () => {
    // typescript テンプレートは engines.node ">=20.0.0" / scripts.dev "tsx src/index.ts" を持つ
    fs.writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({
        name: "existing-app",
        engines: { node: ">=22" },
        scripts: { dev: "tsx src/cli.ts" },
      })
    );
    await runInit(cwd, { template: "typescript", name: "existing-app", yes: true });

    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    // 既存値はテンプレートで上書きされない
    expect(pkg.engines.node).toBe(">=22");
    expect(pkg.scripts.dev).toBe("tsx src/cli.ts");
    // テンプレートの新規キーは追加される
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
    expect(pkg.scripts.test).toBe("vitest");
  });

  it("新規プロジェクトではレイヤー間の上書き(後勝ち)が機能する", async () => {
    // node-react は typescript(build: "tsc") の上に react(build: "tsc --noEmit && vite build") を重ねる
    await runInit(cwd, { template: "node-react", name: "fresh-app", yes: true });

    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    expect(pkg.scripts.build).toBe("tsc --noEmit && vite build");
  });

  it("python テンプレートは FastAPI 一式と Ruff/mypy 設定を展開する", async () => {
    await runInit(cwd, { template: "python", name: "py-app", yes: true });

    expect(readConfig(cwd)?.template).toBe("python");
    // 実行/テスト/依存/ツール設定が揃っている
    for (const f of [
      "main.py",
      "tests/test_main.py",
      "requirements.txt",
      "requirements-dev.txt",
      "pyproject.toml",
    ]) {
      expect(fs.existsSync(path.join(cwd, f)), `${f} が生成されていない`).toBe(true);
    }
    // projectName が埋め込まれ、Ruff/mypy が設定されている
    expect(fs.readFileSync(path.join(cwd, "main.py"), "utf8")).toContain("py-app");
    const pyproject = fs.readFileSync(path.join(cwd, "pyproject.toml"), "utf8");
    expect(pyproject).toContain("[tool.ruff]");
    expect(pyproject).toContain("[tool.mypy]");
    // AI チェックリストが npm ではなく Python のコマンドになっている
    const claude = fs.readFileSync(path.join(cwd, "CLAUDE.md"), "utf8");
    expect(claude).toContain("ruff check");
    expect(claude).not.toContain("npm run typecheck");
  });
});
