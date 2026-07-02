import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { findAiRoot, startSession } from "../src/commands/session";

let tmp: string;

const write = (rel: string, content: string) => {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

beforeEach(() => {
  // /tmp が /private/tmp の symlink でも一致するよう realpath を取る
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-session-")));
  write(".ai/templates/session/requirements.md", "# 要件");
  write(".ai/templates/session/design.md", "# 設計");
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("findAiRoot", () => {
  it("サブディレクトリからでも .ai の親を見つける", () => {
    fs.mkdirSync(path.join(tmp, "src/deep"), { recursive: true });
    expect(findAiRoot(path.join(tmp, "src/deep"))).toBe(tmp);
  });

  it(".ai が無ければ null", () => {
    const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-bare-")));
    try {
      expect(findAiRoot(bare)).toBeNull();
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("startSession", () => {
  it("テンプレートからセッションを作成する", () => {
    startSession(tmp, "add-login");
    const dir = path.join(tmp, ".ai/sessions/add-login");
    expect(fs.readdirSync(dir).sort()).toEqual(["design.md", "requirements.md"]);
  });

  it("既存セッションはエラー", () => {
    startSession(tmp, "dup");
    expect(() => startSession(tmp, "dup")).toThrow(/既に存在/);
  });

  it("不正な名前はエラー", () => {
    expect(() => startSession(tmp, "../evil")).toThrow(/不正/);
    expect(() => startSession(tmp, "a b")).toThrow(/不正/);
    expect(() => startSession(tmp, ".hidden")).toThrow(/不正/);
  });
});
