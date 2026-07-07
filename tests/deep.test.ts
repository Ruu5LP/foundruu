import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { runDeepDoctor, scanDocs } from "../src/doctor/deep";

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

describe("runDeepDoctor", () => {
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

  it("不足観点には改善案が付く", () => {
    write("docs/requirements.md", "## 目的\nAPIを作る\n");
    const report = runDeepDoctor(tmp, "main");
    const req = report.scores.find((s) => s.category === "requirements")!;
    expect(req.score).toBeLessThan(100);
    expect(req.failed.some((f) => f.improvement.includes("対象外"))).toBe(true);
  });
});
