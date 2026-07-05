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
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { latestReport, runCloudPush } from "../src/commands/cloud";

let cwd: string;

/** reports/ に deep レポートを1件用意して、そのファイル名を返す */
const seedReport = (content: string): string => {
  const dir = path.join(cwd, "reports");
  fs.mkdirSync(dir, { recursive: true });
  const name = "foundruu-deep-report-2026-07-01.json";
  fs.writeFileSync(path.join(dir, name), content);
  return name;
};

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

/**
 * ここからは実際の送信経路のテスト。GitHub API への PUT(fetch)と gh のトークン取得は
 * 本物に触らせたくないので:
 *   - トークンは環境変数 GH_TOKEN を差し込んで gh 実行を避ける(resolveToken は env 優先)
 *   - fetch は vi.stubGlobal で偽関数に差し替え、リクエストの中身とレスポンス分岐を検証する
 */
describe("runCloudPush(送信をモック)", () => {
  beforeEach(() => {
    vi.stubEnv("GH_TOKEN", "test-token"); // gh auth token を叩かせない
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("最新レポートを正しい URL・PUT・base64 本文で送信する", async () => {
    const name = seedReport('{"overall":80}');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await runCloudPush(cwd, { repo: "owner/repo", project: "proj" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.github.com/repos/owner/repo/contents/reports/proj/${name}`);
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body.content).toBe(Buffer.from('{"overall":80}').toString("base64"));
    expect(body.message).toContain("proj");
  });

  it("プロジェクト名の安全でない文字はハイフンに正規化される", async () => {
    seedReport("{}");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await runCloudPush(cwd, { repo: "o/r", project: "a b/c" });

    expect(fetchMock.mock.calls[0][0]).toContain("/reports/a-b-c/");
  });

  it("HTTP 422(同名あり)は例外にせず警告で止まる", async () => {
    seedReport("{}");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));

    await expect(runCloudPush(cwd, { repo: "o/r", project: "p" })).resolves.toBeUndefined();
  });

  it("その他の失敗レスポンスは例外にする", async () => {
    seedReport("{}");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" })
    );

    await expect(runCloudPush(cwd, { repo: "o/r", project: "p" })).rejects.toThrow(/HTTP 500/);
  });
});
