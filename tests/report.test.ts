import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { writeDeepReports } from "../src/doctor/report";
import { DeepReport } from "../src/doctor/deep";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-report-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const baseReport = (over: Partial<DeepReport["trace"]>): DeepReport => ({
  since: "main",
  diff: { files: 2, insertions: 10, deletions: 3, untracked: 0 },
  scores: [
    {
      category: "requirements",
      label: "要件品質",
      docPath: "docs/requirements.md",
      score: 83,
      failed: [
        { id: "requirements.permissions", label: "権限条件がある", improvement: "権限を明記する" },
      ],
    },
    { category: "design", label: "設計品質", score: 0, failed: [] },
  ],
  overall: 83,
  trace: {
    designPath: undefined,
    checkedFiles: 0,
    undocumented: [],
    acceptanceIds: [],
    untestedIds: [],
    unplannedIds: [],
    ...over,
  },
});

describe("writeDeepReports", () => {
  it("json / md / html の3ファイルを書き出し、スコアと改善案を含む", () => {
    const files = writeDeepReports(baseReport({}), tmp);
    expect(files).toHaveLength(3);
    const md = fs.readFileSync(files[1], "utf8");
    expect(md).toContain("83点");
    expect(md).toContain("権限条件がある");
    expect(md).toContain("突き合わせ対象の変更ファイルなし");
    expect(md).toContain("AC-n) は未使用");
    const html = fs.readFileSync(files[2], "utf8");
    expect(html).toContain("トレーサビリティ");
  });

  it("設計に記載のない変更ファイルと未参照 AC を md / html に出力する", () => {
    const report = baseReport({
      designPath: "docs/design.md",
      checkedFiles: 2,
      undocumented: ["src/b.ts"],
      acceptanceIds: ["AC-1", "AC-2"],
      untestedIds: ["AC-2"],
      unplannedIds: ["AC-1"],
    });
    const files = writeDeepReports(report, tmp);
    const md = fs.readFileSync(files[1], "utf8");
    expect(md).toContain("記載のない変更ファイル: src/b.ts");
    expect(md).toContain("テスト観点から未参照の受け入れ条件: AC-2");
    expect(md).toContain("タスクから未参照の受け入れ条件: AC-1");
    const html = fs.readFileSync(files[2], "utf8");
    expect(html).toContain("src/b.ts");
  });

  it("全ファイル記載あり・全 AC 参照済みの場合は ✔ で出力する", () => {
    const report = baseReport({
      designPath: "docs/design.md",
      checkedFiles: 3,
      acceptanceIds: ["AC-1"],
    });
    const md = fs.readFileSync(writeDeepReports(report, tmp)[1], "utf8");
    expect(md).toContain("✔ 変更ファイル 3 件はすべて設計");
    expect(md).toContain("✔ 受け入れ条件 1 件はすべて参照済み");
  });

  it("未追跡ファイルがある場合は差分行に付記される", () => {
    const report = baseReport({});
    report.diff.untracked = 2;
    const md = fs.readFileSync(writeDeepReports(report, tmp)[1], "utf8");
    expect(md).toContain("（ほか未追跡 2 ファイル）");
  });

  it("未追跡 0 件時は差分行に付記されない", () => {
    const md = fs.readFileSync(writeDeepReports(baseReport({}), tmp)[1], "utf8");
    expect(md).not.toContain("未追跡");
  });

  it("設計ドキュメントが無い場合は未実施と出力する", () => {
    const report = baseReport({ checkedFiles: 1 });
    const md = fs.readFileSync(writeDeepReports(report, tmp)[1], "utf8");
    expect(md).toContain("突き合わせは未実施");
  });
});
