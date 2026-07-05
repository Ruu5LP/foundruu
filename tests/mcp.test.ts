/**
 * mcp コマンド(runMcpServer)のテスト。
 *
 * runMcpServer は stdio 上に MCP サーバーを常駐させるため、そのまま呼ぶとプロセスが
 * 終わらない。そこで MCP SDK の McpServer / StdioServerTransport を vi.mock で差し替え、
 * サーバーを立てずに次を検証する:
 *   - doctor / doctor_deep / session_start / session_list / workflow_install / update の
 *     6 ツールが登録される
 *   - stdout を汚さないよう log.useStderr() が呼ばれ、transport に connect する
 *   - 登録された doctor ハンドラが実際に runDoctor を実行し text コンテンツを返す
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// McpServer の tool 登録と connect をモックで捕捉する(vi.hoisted で共有状態を用意)
const { toolCalls, connectMock } = vi.hoisted(() => ({
  toolCalls: [] as unknown[][],
  connectMock: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    tool(...args: unknown[]) {
      toolCalls.push(args);
    }
    connect = connectMock;
  },
}));
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {},
}));

import { runMcpServer } from "../src/commands/mcp";
import { log } from "../src/core/logger";

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-mcp-"));
  toolCalls.length = 0;
  connectMock.mockClear();
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runMcpServer", () => {
  it("6 つのツールを登録し、transport に connect する", async () => {
    const useStderr = vi.spyOn(log, "useStderr");
    await runMcpServer(cwd);

    const names = toolCalls.map((c) => c[0]);
    expect(names).toEqual([
      "doctor",
      "doctor_deep",
      "session_start",
      "session_list",
      "workflow_install",
      "update",
    ]);
    expect(useStderr).toHaveBeenCalledOnce(); // stdout を JSON-RPC 専用に保つ
    expect(connectMock).toHaveBeenCalledOnce();
  });

  it("doctor ハンドラは runDoctor を実行し text コンテンツを返す", async () => {
    await runMcpServer(cwd);
    const doctor = toolCalls.find((c) => c[0] === "doctor");
    const handler = doctor![3] as (arg: { directory?: string }) => Promise<{
      content: { type: string; text: string }[];
    }>;

    const result = await handler({});
    expect(result.content[0].type).toBe("text");
    // runDoctor の JSON 結果(results 配列を持つ)が本文に載る
    expect(JSON.parse(result.content[0].text)).toHaveProperty("results");
  });
});
