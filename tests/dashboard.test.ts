/**
 * dashboard コマンドのテスト。
 *
 * dashboard は deep レポート履歴を読み込み、スコア推移の HTML を生成する。
 * 検証範囲:
 *   - loadHistory: ディレクトリ非存在/空なら空配列、foundruu-deep-report-*.json を
 *     ファイル名順(=時系列)で読み、タイムスタンプを抽出する
 *   - renderDashboard: 最新の総合スコア・カテゴリ行を含み、2 件以上では前回比の
 *     矢印(▲/▼)を出す。docPath 無しは「（なし）」表記になる
 *   - runDashboard: 履歴があれば既定で index.html を書き出し、無ければ書き込まず
 *     exitCode=1 で終える(誤って空ダッシュボードを作らない)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadHistory, renderDashboard, runDashboard } from "../src/commands/dashboard";
import { DeepReport } from "../src/doctor/deep";

let cwd: string;

const report = (overall: number, reqScore: number, docPath?: string): DeepReport => ({
  since: "main",
  diff: { files: 0, insertions: 0, deletions: 0 },
  overall,
  scores: [{ category: "requirements", label: "要件品質", score: reqScore, docPath, failed: [] }],
});

const writeReport = (dir: string, timestamp: string, r: DeepReport): void => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `foundruu-deep-report-${timestamp}.json`), JSON.stringify(r));
};

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-dash-"));
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
  process.exitCode = 0; // runDashboard が立てた exitCode をテスト間で持ち越さない
});

describe("loadHistory", () => {
  it("ディレクトリが無ければ空配列", () => {
    expect(loadHistory(path.join(cwd, "missing"))).toEqual([]);
  });

  it("レポートをファイル名順に読み、タイムスタンプを抽出する", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-07-01", report(70, 70));
    writeReport(dir, "2026-01-01", report(40, 40));
    const history = loadHistory(dir);
    expect(history.map((e) => e.timestamp)).toEqual(["2026-01-01", "2026-07-01"]);
    expect(history[1].report.overall).toBe(70);
  });
});

describe("renderDashboard", () => {
  it("最新の総合スコアとカテゴリ行を含む", () => {
    const html = renderDashboard([
      { timestamp: "2026-07-01", report: report(82, 82, "docs/req.md") },
    ]);
    expect(html).toContain("総合スコア: 82点");
    expect(html).toContain("要件品質");
    expect(html).toContain("docs/req.md");
  });

  it("2 件以上ではカテゴリスコアの前回比(▲/▼)を出す", () => {
    const up = renderDashboard([
      { timestamp: "t1", report: report(40, 40) },
      { timestamp: "t2", report: report(70, 70) },
    ]);
    expect(up).toContain("▲30");

    const down = renderDashboard([
      { timestamp: "t1", report: report(70, 70) },
      { timestamp: "t2", report: report(50, 50) },
    ]);
    expect(down).toContain("▼20");
  });

  it("docPath が無いカテゴリは「（なし）」表記", () => {
    const html = renderDashboard([{ timestamp: "t1", report: report(50, 50, undefined) }]);
    expect(html).toContain("（なし）");
  });
});

describe("runDashboard", () => {
  it("履歴があれば既定で index.html を書き出す", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-07-01", report(82, 82));
    runDashboard(cwd, {});
    const out = path.join(dir, "index.html");
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf8")).toContain("総合スコア: 82点");
  });

  it("--out で出力先を指定できる", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-07-01", report(82, 82));
    runDashboard(cwd, { out: "custom.html" });
    expect(fs.existsSync(path.join(cwd, "custom.html"))).toBe(true);
  });

  it("レポートが無ければ書き込まず exitCode=1 で終える", () => {
    runDashboard(cwd, {});
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(cwd, "reports", "index.html"))).toBe(false);
  });
});
