import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { renderChangelogDraft } from "../src/core/changelog";

let tmp: string;

const write = (rel: string, content: string) => {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-changelog-")));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("renderChangelogDraft", () => {
  it("summary.md の冒頭を要約として使う", () => {
    write("summary.md", "# まとめ\n\nログイン機能を追加した。\n");
    write("requirements.md", "# 要件\n\n目的の説明。\n");
    const draft = renderChangelogDraft("login-feature", tmp);
    expect(draft).toContain("**login-feature**: ログイン機能を追加した。");
  });

  it("summary.md が無ければ requirements.md の冒頭を使う", () => {
    write("requirements.md", "# 要件\n\nCSV エクスポートを追加する。\n");
    const draft = renderChangelogDraft("csv-export", tmp);
    expect(draft).toContain("**csv-export**: CSV エクスポートを追加する。");
  });

  it("受け入れ条件(AC-n)を箇条書きで含める", () => {
    write(
      "requirements.md",
      "# 要件\n\n目的。\n\n## 完了条件\n\n- [x] AC-1: CSV を出力できる\n- [ ] AC-2: 文字コードを選べる\n"
    );
    const draft = renderChangelogDraft("csv-export", tmp);
    expect(draft).toContain("  - AC-1: CSV を出力できる");
    expect(draft).toContain("  - AC-2: 文字コードを選べる");
  });

  it("材料が無くてもプレースホルダー付きで生成される", () => {
    const draft = renderChangelogDraft("empty-session", tmp);
    expect(draft).toContain("**empty-session**: （要約を記入）");
    expect(draft).toContain("### Added");
  });
});
