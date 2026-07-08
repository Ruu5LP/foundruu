import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { installHooks, uninstallHooks } from "../src/commands/hooks";

let tmp: string;

const hookFile = () => path.join(tmp, ".git", "hooks", "pre-commit");

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-hooks-")));
  execFileSync("git", ["-C", tmp, "init", "-q", "-b", "main"]);
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("installHooks", () => {
  it("マーカー入りの実行可能な pre-commit フックを生成する", () => {
    installHooks(tmp);
    const content = fs.readFileSync(hookFile(), "utf8");
    expect(content).toContain("# FoundRuu pre-commit hook");
    expect(content).toContain("doctor");
    // 実行権限が付いている
    expect(fs.statSync(hookFile()).mode & 0o100).toBeTruthy();
  });

  it("既存の他者フックがあると --force なしでは失敗する", () => {
    fs.mkdirSync(path.dirname(hookFile()), { recursive: true });
    fs.writeFileSync(hookFile(), "#!/bin/sh\necho custom\n");
    expect(() => installHooks(tmp)).toThrow(/既存の pre-commit フック/);
    // --force なら上書きされる
    installHooks(tmp, { force: true });
    expect(fs.readFileSync(hookFile(), "utf8")).toContain("# FoundRuu pre-commit hook");
  });

  it("自分が生成したフックは --force なしで再インストールできる", () => {
    installHooks(tmp);
    expect(() => installHooks(tmp)).not.toThrow();
  });

  it("git リポジトリ外ではエラーになる", () => {
    const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-nogit-")));
    try {
      expect(() => installHooks(bare)).toThrow(/git リポジトリではありません/);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("uninstallHooks", () => {
  it("自分が生成したフックだけを削除する", () => {
    installHooks(tmp);
    uninstallHooks(tmp);
    expect(fs.existsSync(hookFile())).toBe(false);
  });

  it("他者のフックは削除しない", () => {
    fs.mkdirSync(path.dirname(hookFile()), { recursive: true });
    fs.writeFileSync(hookFile(), "#!/bin/sh\necho custom\n");
    expect(() => uninstallHooks(tmp)).toThrow(/FoundRuu が生成したものではない/);
    expect(fs.existsSync(hookFile())).toBe(true);
  });
});
