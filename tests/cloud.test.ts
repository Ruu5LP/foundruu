/**
 * cloud コマンドのテスト。
 *
 * runCloudPush は最新の deep レポートを foundruu-cloud へ送信する。
 * 実際の GitHub API 送信はネットワーク・トークンを要するためここでは扱わず、
 * 送信前の「どのレポートを選ぶか」「レポートが無いとき安全に止まるか」を検証する:
 *   - latestReport はディレクトリ非存在/空なら null
 *   - latestReport は foundruu-deep-report-*.json のうち末尾(最新)を選ぶ
 *   - runCloudPush はレポートが無ければ送信前に例外で止まる(誤送信しない)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { latestReport, runCloudPush } from "../src/commands/cloud";

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-cloud-"));
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe("latestReport", () => {
  it("ディレクトリが無ければ null", () => {
    expect(latestReport(path.join(cwd, "missing"))).toBeNull();
  });

  it("deep レポートが無ければ null(無関係なファイルは無視)", () => {
    const dir = path.join(cwd, "reports");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "note.txt"), "x");
    fs.writeFileSync(path.join(dir, "index.html"), "x");
    expect(latestReport(dir)).toBeNull();
  });

  it("foundruu-deep-report-*.json のうち末尾(最新)を選ぶ", () => {
    const dir = path.join(cwd, "reports");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "foundruu-deep-report-2026-01-01.json"), "{}");
    fs.writeFileSync(path.join(dir, "foundruu-deep-report-2026-07-01.json"), "{}");
    const result = latestReport(dir);
    expect(result?.name).toBe("foundruu-deep-report-2026-07-01.json");
    expect(result?.file).toBe(path.join(dir, "foundruu-deep-report-2026-07-01.json"));
  });
});

describe("runCloudPush", () => {
  it("レポートが無ければ送信前に例外で止まる", async () => {
    await expect(runCloudPush(cwd, {})).rejects.toThrow(/レポートがありません/);
  });
});
