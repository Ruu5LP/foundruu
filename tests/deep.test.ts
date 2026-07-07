import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { runDeepDoctor, scanDocs } from "../src/doctor/deep";

const trace = (report: ReturnType<typeof runDeepDoctor>) => report.trace;

let tmp: string;

const git = (args: string[]) => execFileSync("git", ["-C", tmp, ...args], { stdio: "pipe" });
const write = (rel: string, content: string) => {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-deep-"));
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  write("a.txt", "hello\n");
  git(["add", "."]);
  git(["commit", "-q", "-m", "init"]);
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("scanDocs", () => {
  it("docs/ と .ai/sessions/ からカテゴリ別にドキュメントを見つける", () => {
    write("docs/requirements.md", "# 要件");
    write(".ai/sessions/s1/design.md", "# 設計");
    const docs = scanDocs(tmp);
    expect(docs.get("requirements")?.path).toBe("docs/requirements.md");
    expect(docs.get("design")?.path).toBe(path.join(".ai/sessions/s1", "design.md"));
  });

  it("別名のファイル名も拾う(architecture→設計 / spec→要件 / AGENTS→AI指示)", () => {
    write("docs/architecture.md", "# アーキテクチャ");
    write("docs/spec.md", "# 仕様");
    write("AGENTS.md", "# AIエージェントへの指示");
    const docs = scanDocs(tmp);
    expect(docs.get("design")?.path).toBe("docs/architecture.md");
    expect(docs.get("requirements")?.path).toBe("docs/spec.md");
    expect(docs.get("aiInstructions")?.path).toBe("AGENTS.md");
  });

  it("tasks.md / plan.md を計画(plan)カテゴリとして拾う", () => {
    write(".ai/sessions/s1/tasks.md", "# タスク");
    const docs = scanDocs(tmp);
    expect(docs.get("plan")?.path).toBe(path.join(".ai/sessions/s1", "tasks.md"));
  });

  it(".ai/sessions/ 直下の隠しディレクトリ(.status 等)は最新セッションとして選ばない", () => {
    write(".ai/sessions/s1/requirements.md", "# 要件");
    // session start が作る管理用ディレクトリ。実セッションより新しい mtime でも無視される
    write(".ai/sessions/.status/s1.json", "{}");
    const docs = scanDocs(tmp);
    expect(docs.get("requirements")?.path).toBe(path.join(".ai/sessions/s1", "requirements.md"));
  });
});

describe("トレーサビリティ", () => {
  it("設計に記載のない変更ファイルを検出し、記載済みは警告しない", () => {
    write(".ai/sessions/s1/design.md", "## 変更対象\n- `src/a.ts`\n");
    write("src/a.ts", "export {};\n");
    write("src/b.ts", "export {};\n");
    const t = trace(runDeepDoctor(tmp, "main"));
    expect(t.designPath).toBe(path.join(".ai/sessions/s1", "design.md"));
    expect(t.undocumented).toEqual(["src/b.ts"]);
  });

  it("ディレクトリ接頭辞・ファイル名の言及でも記載ありとみなす", () => {
    write(".ai/sessions/s1/design.md", "## 変更対象\n- src/commands/ 配下\n- deep.ts\n");
    write("src/commands/foo.ts", "export {};\n");
    write("src/doctor/deep.ts", "export {};\n");
    const t = trace(runDeepDoctor(tmp, "main"));
    expect(t.undocumented).toEqual([]);
  });

  it("Markdown や .ai/ 配下はデフォルトで突き合わせ対象外", () => {
    write(".ai/sessions/s1/design.md", "## 変更対象\n- なし\n");
    write("docs/notes.md", "# メモ");
    write("README.md", "# readme");
    const t = trace(runDeepDoctor(tmp, "main"));
    expect(t.checkedFiles).toBe(0);
  });

  it("traceExcludes(glob) で追加の除外ができる", () => {
    write(".ai/sessions/s1/design.md", "## 変更対象\n- なし\n");
    write("dist/bundle.js", "generated");
    const before = trace(runDeepDoctor(tmp, "main"));
    expect(before.undocumented).toEqual(["dist/bundle.js"]);
    const after = trace(runDeepDoctor(tmp, "main", [], ["dist/**"]));
    expect(after.checkedFiles).toBe(0);
  });

  it("設計ドキュメントが無い場合は突き合わせ未実施(designPath なし)", () => {
    write("src/a.ts", "export {};\n");
    const t = trace(runDeepDoctor(tmp, "main"));
    expect(t.designPath).toBeUndefined();
    expect(t.undocumented).toEqual([]);
  });

  it("要件の AC-n がタスク・テスト観点から参照されているか検証する", () => {
    write("docs/requirements.md", "## 完了条件\n- [ ] AC-1: 保存できる\n- [ ] AC-2: 警告が出る\n");
    write("docs/tasks.md", "## 実装タスク\n- [ ] 保存処理 (AC-1)\n- [ ] 警告表示 (AC-2)\n");
    write("docs/test.md", "## テスト観点\n- AC-1: 保存の正常系\n");
    const t = trace(runDeepDoctor(tmp, "main"));
    expect(t.acceptanceIds).toEqual(["AC-1", "AC-2"]);
    expect(t.untestedIds).toEqual(["AC-2"]);
    expect(t.unplannedIds).toEqual([]);
  });

  it("AC-n が無い場合は空のトレース結果になる", () => {
    write("docs/requirements.md", "## 目的\n保存機能\n");
    const t = trace(runDeepDoctor(tmp, "main"));
    expect(t.acceptanceIds).toEqual([]);
    expect(t.untestedIds).toEqual([]);
  });
});

describe("runDeepDoctor", () => {
  it("未追跡ファイル数を diff.untracked として数える(diff.files には含めない)", () => {
    write("src/new-file.ts", "export {};\n");
    const report = runDeepDoctor(tmp, "main");
    expect(report.diff.untracked).toBe(1);
    expect(report.diff.files).toBe(0);
  });

  it("ドキュメントが無いカテゴリは未計測(docPath なし)で、総合は 0 のまま", () => {
    const report = runDeepDoctor(tmp, "main");
    expect(report.scores.every((s) => s.docPath === undefined)).toBe(true);
    expect(report.overall).toBe(0);
  });

  it("総合スコアは計測できた(docPath あり)カテゴリのみで平均する", () => {
    // requirements だけ満点、他3カテゴリは未計測 → 0 で薄めず総合 100
    write(
      "docs/requirements.md",
      "## 目的\n## 対象外\n## 正常系\n## 異常系\n## 権限\n## 完了条件\n"
    );
    const report = runDeepDoctor(tmp, "main");
    expect(report.scores.find((s) => s.category === "requirements")!.score).toBe(100);
    expect(report.overall).toBe(100);
  });

  it("観点が揃った要件ドキュメントは高スコアになる", () => {
    write(
      "docs/requirements.md",
      "## 目的\n## 対象外\n## 正常系\n## 異常系\n## 権限\n## 完了条件\n"
    );
    write("b.txt", "changed\n");
    const report = runDeepDoctor(tmp, "main");
    const req = report.scores.find((s) => s.category === "requirements")!;
    expect(req.score).toBe(100);
    expect(req.failed).toHaveLength(0);
    expect(req.docPath).toBe("docs/requirements.md");
  });

  it("観点が揃ったタスクドキュメントは計画品質が満点になる", () => {
    write(
      "docs/tasks.md",
      "## 実装タスク\n- [ ] a\n## 依存関係と順序\n## リスク・懸念\n## 完了条件\n- [ ] b\n"
    );
    const report = runDeepDoctor(tmp, "main");
    const plan = report.scores.find((s) => s.category === "plan")!;
    expect(plan.score).toBe(100);
    expect(plan.failed).toHaveLength(0);
  });

  it(".foundruurc の doctor.deep.disable 相当でルールを採点分母から除外できる", () => {
    // API入出力・ロールバックは CLI リポジトリでは満たしにくい観点の代表
    write("docs/design.md", "## 変更対象\n## 既存への影響\n## エラー\n## 処理フロー\n");
    const before = runDeepDoctor(tmp, "main");
    expect(before.scores.find((s) => s.category === "design")!.score).toBe(67); // 4/6
    const after = runDeepDoctor(tmp, "main", ["design.api-io", "design.rollback"]);
    expect(after.scores.find((s) => s.category === "design")!.score).toBe(100); // 4/4
  });

  it("未知のルールIDは無視され、採点結果は変わらない", () => {
    write("docs/design.md", "## 変更対象\n");
    const base = runDeepDoctor(tmp, "main");
    const withUnknown = runDeepDoctor(tmp, "main", ["design.no-such-rule"]);
    expect(withUnknown.scores).toEqual(base.scores);
  });

  it("カテゴリの全観点を無効化すると未計測(docPath なし)になる", () => {
    write("docs/design.md", "## 変更対象\n");
    const report = runDeepDoctor(tmp, "main", [
      "design.change-targets",
      "design.existing-impact",
      "design.api-io",
      "design.error-handling",
      "design.rollback",
      "design.flow",
    ]);
    const design = report.scores.find((s) => s.category === "design")!;
    expect(design.docPath).toBeUndefined();
    expect(design.failed).toHaveLength(0);
  });

  it("不足観点には改善案が付く", () => {
    write("docs/requirements.md", "## 目的\nAPIを作る\n");
    const report = runDeepDoctor(tmp, "main");
    const req = report.scores.find((s) => s.category === "requirements")!;
    expect(req.score).toBeLessThan(100);
    expect(req.failed.some((f) => f.improvement.includes("対象外"))).toBe(true);
  });
});
