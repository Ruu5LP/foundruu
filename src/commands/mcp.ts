import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { cliVersion } from "../core/config";
import { log } from "../core/logger";
import { runDoctor } from "../doctor/runner";
import { runDeepDoctor } from "../doctor/deep";
import { installWorkflow } from "./workflow";
import { startSession, sessionNames } from "./session";
import { runUpdate } from "./update";

/**
 * FoundRuu MCP Server(stdio)。
 * Claude Code / Codex 等の AI エージェントが doctor / session / workflow / update を
 * ツールとして直接呼べるようにする。
 *
 * 登録例(Claude Code):
 *   claude mcp add foundruu -- npx foundruu mcp
 */

const resolveDir = (base: string, dir?: string): string =>
  dir ? path.resolve(base, dir) : base;

const text = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

export async function runMcpServer(cwd: string): Promise<void> {
  // stdout は JSON-RPC 専用。CLI ログはすべて stderr へ
  log.useStderr();

  const server = new McpServer({ name: "foundruu", version: cliVersion() });
  const dirSchema = z
    .string()
    .optional()
    .describe("対象ディレクトリ(省略時はサーバー起動ディレクトリ)");

  server.tool(
    "doctor",
    "リポジトリがAI開発可能な状態か診断する(README / AI Rules / Workflow 等の健全性チェック)",
    { directory: dirSchema },
    async ({ directory }) => text(runDoctor(resolveDir(cwd, directory)))
  );

  server.tool(
    "doctor_deep",
    "docs/ と git 差分から AI開発プロセスの品質(要件/設計/テスト/AI指示)をスコア診断する",
    { directory: dirSchema, since: z.string().optional().describe("差分比較基準(デフォルト main)") },
    async ({ directory, since }) => text(runDeepDoctor(resolveDir(cwd, directory), since ?? "main"))
  );

  server.tool(
    "session_start",
    "AI開発セッションを作成する(.ai/sessions/<name>/ に requirements/design/tasks 等を生成)",
    { name: z.string().describe("セッション名(英数字・ハイフン)"), directory: dirSchema },
    async ({ name, directory }) => {
      startSession(resolveDir(cwd, directory), name);
      return text(
        `セッション .ai/sessions/${name}/ を作成しました。requirements.md に要件を書き、.ai/prompts/session-workflow.md のルールに従って進めてください。`
      );
    }
  );

  server.tool(
    "session_list",
    "既存のAI開発セッションを一覧する",
    { directory: dirSchema },
    async ({ directory }) => text({ sessions: sessionNames(resolveDir(cwd, directory)) })
  );

  server.tool(
    "workflow_install",
    "Workflow / Prompt / Rules(.ai/)をリポジトリへ導入する",
    { directory: dirSchema },
    async ({ directory }) => {
      installWorkflow(resolveDir(cwd, directory));
      return text("Workflow を導入しました(.ai/prompts, .ai/workflows, .ai/templates/session)。");
    }
  );

  server.tool(
    "update",
    "Workflow / Prompt / Rules を最新へ更新する(ユーザー編集済みファイルは保護される)",
    {
      directory: dirSchema,
      diff: z.boolean().optional().describe("true なら差分確認のみで書き込まない"),
    },
    async ({ directory, diff }) => {
      runUpdate(resolveDir(cwd, directory), { diff });
      return text(diff ? "差分を確認しました(stderr ログ参照)。" : "更新を実行しました。");
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info(`foundruu MCP server v${cliVersion()} started (stdio)`);
}
