/**
 * 公式プラグイン foundruu-plugin-cloud のテスト。
 *
 * プラグインは計測系の 2 コマンド(cloud push / dashboard)を追加する。
 * 旧 src/commands/{cloud,dashboard}.ts から切り出したもので、検証内容も引き継ぐ:
 *   - register が cloud / dashboard コマンドを登録する
 *   - latestReport: ディレクトリ非存在/空なら null、foundruu-deep-report-*.json の末尾(最新)を選ぶ
 *   - runCloudPush: レポートが無ければ送信前に例外で止まる。送信は URL・PUT・base64 本文、
 *     422 は警告のみ、その他の失敗は例外
 *   - loadHistory / renderDashboard / runDashboard: 履歴読み込み・HTML 生成・書き出し
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Command } from "commander";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../plugins/foundruu-plugin-cloud/index.js");

/** プラグイン関数へ渡すロガー(出力は検証対象外なので握りつぶす) */
const silentLog = { info: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn() };

interface DeepReportLike {
  since: string;
  diff: { files: number; insertions: number; deletions: number };
  overall: number;
  scores: {
    category: string;
    label: string;
    score: number;
    docPath?: string;
    failed: { label: string; improvement: string }[];
  }[];
}

let cwd: string;

const report = (
  overall: number,
  reqScore: number,
  docPath?: string, // docPath なし = 未計測扱い
  failed: { label: string; improvement: string }[] = []
): DeepReportLike => ({
  since: "main",
  diff: { files: 0, insertions: 0, deletions: 0 },
  overall,
  scores: [{ category: "requirements", label: "要件品質", score: reqScore, docPath, failed }],
});

const writeReport = (dir: string, timestamp: string, content: string): void => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `foundruu-deep-report-${timestamp}.json`), content);
};

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-plugin-cloud-"));
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
  process.exitCode = 0; // runDashboard が立てた exitCode をテスト間で持ち越さない
});

describe("register", () => {
  it("cloud / dashboard コマンドを登録する", () => {
    const program = new Command();
    plugin.register({ program, addDoctorCheck: () => {}, log: silentLog });
    const names = program.commands.map((cmd) => cmd.name());
    expect(names).toContain("cloud");
    expect(names).toContain("dashboard");
  });
});

describe("latestReport", () => {
  it("ディレクトリが無ければ null", () => {
    expect(plugin.latestReport(path.join(cwd, "missing"))).toBeNull();
  });

  it("deep レポートが無ければ null(無関係なファイルは無視)", () => {
    const dir = path.join(cwd, "reports");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "note.txt"), "x");
    fs.writeFileSync(path.join(dir, "index.html"), "x");
    expect(plugin.latestReport(dir)).toBeNull();
  });

  it("foundruu-deep-report-*.json のうち末尾(最新)を選ぶ", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-01-01", "{}");
    writeReport(dir, "2026-07-01", "{}");
    const result = plugin.latestReport(dir);
    expect(result?.name).toBe("foundruu-deep-report-2026-07-01.json");
    expect(result?.file).toBe(path.join(dir, "foundruu-deep-report-2026-07-01.json"));
  });
});

describe("runCloudPush", () => {
  it("レポートが無ければ送信前に例外で止まる", async () => {
    await expect(plugin.runCloudPush(cwd, {}, silentLog)).rejects.toThrow(/レポートがありません/);
  });
});

/**
 * 実際の送信経路のテスト。GitHub API への PUT(fetch)と gh のトークン取得は
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
    writeReport(path.join(cwd, "reports"), "2026-07-01", '{"overall":80}');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await plugin.runCloudPush(cwd, { repo: "owner/repo", project: "proj" }, silentLog);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/repos/owner/repo/contents/reports/proj/foundruu-deep-report-2026-07-01.json"
    );
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body.content).toBe(Buffer.from('{"overall":80}').toString("base64"));
    expect(body.message).toContain("proj");
  });

  it("プロジェクト名の安全でない文字はハイフンに正規化される", async () => {
    writeReport(path.join(cwd, "reports"), "2026-07-01", "{}");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await plugin.runCloudPush(cwd, { repo: "o/r", project: "a b/c" }, silentLog);

    expect(fetchMock.mock.calls[0][0]).toContain("/reports/a-b-c/");
  });

  it("HTTP 422(同名あり)は例外にせず警告で止まる", async () => {
    writeReport(path.join(cwd, "reports"), "2026-07-01", "{}");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));

    await expect(
      plugin.runCloudPush(cwd, { repo: "o/r", project: "p" }, silentLog)
    ).resolves.toBeUndefined();
  });

  it("その他の失敗レスポンスは例外にする", async () => {
    writeReport(path.join(cwd, "reports"), "2026-07-01", "{}");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" })
    );

    await expect(
      plugin.runCloudPush(cwd, { repo: "o/r", project: "p" }, silentLog)
    ).rejects.toThrow(/HTTP 500/);
  });
});

describe("loadHistory", () => {
  it("ディレクトリが無ければ空配列", () => {
    expect(plugin.loadHistory(path.join(cwd, "missing"))).toEqual([]);
  });

  it("レポートをファイル名順に読み、タイムスタンプを抽出する", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-07-01", JSON.stringify(report(70, 70)));
    writeReport(dir, "2026-01-01", JSON.stringify(report(40, 40)));
    const history = plugin.loadHistory(dir);
    expect(history.map((entry: { timestamp: string }) => entry.timestamp)).toEqual([
      "2026-01-01",
      "2026-07-01",
    ]);
    expect(history[1].report.overall).toBe(70);
  });
});

const historyEntry = (timestamp: string, entryReport: DeepReportLike) => ({
  timestamp,
  report: entryReport,
});

describe("renderDashboard", () => {
  it("最新の総合スコアとカテゴリ行を含む", () => {
    const html = plugin.renderDashboard([
      historyEntry("2026-07-01", report(82, 82, "docs/req.md")),
    ]);
    expect(html).toContain("総合スコア: 82点");
    expect(html).toContain("要件品質");
    expect(html).toContain("docs/req.md");
  });

  it("2 件以上ではカテゴリスコアの前回比(▲/▼)を出す", () => {
    const up = plugin.renderDashboard([
      historyEntry("t1", report(40, 40, "docs/req.md")),
      historyEntry("t2", report(70, 70, "docs/req.md")),
    ]);
    expect(up).toContain("▲30");

    const down = plugin.renderDashboard([
      historyEntry("t1", report(70, 70, "docs/req.md")),
      historyEntry("t2", report(50, 50, "docs/req.md")),
    ]);
    expect(down).toContain("▼20");
  });

  it("docPath が無いカテゴリは「（なし）」表記", () => {
    const html = plugin.renderDashboard([historyEntry("t1", report(50, 50, undefined))]);
    expect(html).toContain("（なし）");
  });

  it("未達項目があれば改善アクション(label → improvement)を出す", () => {
    const html = plugin.renderDashboard([
      historyEntry(
        "t1",
        report(30, 30, "docs/req.md", [
          { label: "正常系がある", improvement: "代表的な正常系シナリオを追記する" },
        ])
      ),
    ]);
    expect(html).toContain("改善アクション");
    expect(html).toContain("正常系がある");
    expect(html).toContain("代表的な正常系シナリオを追記する");
  });

  it("未達項目が無ければ改善アクションなしと表示する", () => {
    const html = plugin.renderDashboard([historyEntry("t1", report(100, 100, "docs/req.md"))]);
    expect(html).toContain("改善アクションはありません");
  });

  it("計測カテゴリが無ければ 0点 ではなく未計測を表示する", () => {
    const html = plugin.renderDashboard([historyEntry("t1", report(0, 0, undefined))]);
    expect(html).toContain("総合スコア: 未計測");
    expect(html).not.toContain("総合スコア: 0点");
  });
});

describe("runDashboard", () => {
  it("履歴があれば既定で index.html を書き出す", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-07-01", JSON.stringify(report(82, 82, "docs/req.md")));
    plugin.runDashboard(cwd, {}, silentLog);
    const out = path.join(dir, "index.html");
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf8")).toContain("総合スコア: 82点");
  });

  it("--out で出力先を指定できる", () => {
    const dir = path.join(cwd, "reports");
    writeReport(dir, "2026-07-01", JSON.stringify(report(82, 82, "docs/req.md")));
    plugin.runDashboard(cwd, { out: "custom.html" }, silentLog);
    expect(fs.existsSync(path.join(cwd, "custom.html"))).toBe(true);
  });

  it("レポートが無ければ書き込まず exitCode=1 で終える", () => {
    plugin.runDashboard(cwd, {}, silentLog);
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(cwd, "reports", "index.html"))).toBe(false);
  });
});
