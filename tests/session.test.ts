import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  findAiRoot,
  startSession,
  endSession,
  showSession,
  currentSession,
  sessionNames,
} from "../src/commands/session";
import { log } from "../src/core/logger";

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

  it("作成時に現在のセッションと開始時刻を記録する（メタはセッション外）", () => {
    startSession(tmp, "s1");
    expect(fs.readFileSync(path.join(tmp, ".ai/sessions/.current"), "utf8").trim()).toBe("s1");
    const status = JSON.parse(
      fs.readFileSync(path.join(tmp, ".ai/sessions/.status/s1.json"), "utf8")
    );
    expect(status.startedAt).toBeTruthy();
    // メタ用の .current / .status はセッション一覧に混ざらない
    expect(sessionNames(tmp)).toEqual(["s1"]);
  });
});

/**
 * セッションのライフサイクル(end / show / current)のテスト。
 * start で「現在のセッション」になり、end で完了記録して current を解除する。
 * name 省略時は現在のセッションを対象にし、存在しない指定はエラーにする。
 */
describe("session ライフサイクル", () => {
  const currentName = (): string | null => {
    const f = path.join(tmp, ".ai/sessions/.current");
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : null;
  };

  it("end(name 省略)は現在のセッションを完了にし current を解除する", () => {
    startSession(tmp, "s1");
    endSession(tmp);
    const status = JSON.parse(
      fs.readFileSync(path.join(tmp, ".ai/sessions/.status/s1.json"), "utf8")
    );
    expect(status.endedAt).toBeTruthy();
    expect(currentName()).toBeNull();
  });

  it("end は名前を明示指定できる", () => {
    startSession(tmp, "s1");
    startSession(tmp, "s2"); // current は s2 になる
    endSession(tmp, "s1");
    expect(currentName()).toBe("s2"); // s2 は current のまま
  });

  it("現在のセッションが無く名前も無ければ end はエラー", () => {
    startSession(tmp, "s1");
    endSession(tmp); // current 解除
    expect(() => endSession(tmp)).toThrow(/指定してください/);
  });

  it("存在しないセッションの end はエラー", () => {
    expect(() => endSession(tmp, "nope")).toThrow(/見つかりません/);
  });

  it("end 時に CHANGELOG 下書き(changelog-draft.md)を生成する", () => {
    startSession(tmp, "s1");
    write(".ai/sessions/s1/requirements.md", "# 要件\n\nログイン機能を追加する。\n");
    endSession(tmp);
    const draft = fs.readFileSync(path.join(tmp, ".ai/sessions/s1/changelog-draft.md"), "utf8");
    expect(draft).toContain("**s1**: ログイン機能を追加する。");
  });

  it("changelog-draft.md が既にあれば上書きしない", () => {
    startSession(tmp, "s1");
    write(".ai/sessions/s1/changelog-draft.md", "手書きの下書き\n");
    endSession(tmp);
    expect(fs.readFileSync(path.join(tmp, ".ai/sessions/s1/changelog-draft.md"), "utf8")).toBe(
      "手書きの下書き\n"
    );
  });

  it("current は現在のセッション名を表示する", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {});
    startSession(tmp, "s1");
    currentSession(tmp);
    expect(spy.mock.calls.flat().join("\n")).toContain("現在のセッション: s1");
    spy.mockRestore();
  });

  it("show は状態と未記入ファイルを表示する", () => {
    write(".ai/templates/session/summary.md", ""); // 空テンプレ = 未記入で作られる
    const spy = vi.spyOn(log, "info").mockImplementation(() => {});
    startSession(tmp, "s1");
    showSession(tmp);
    const out = spy.mock.calls.flat().join("\n");
    expect(out).toContain("s1（進行中）");
    expect(out).toContain("summary.md（未記入）");
    spy.mockRestore();
  });
});
