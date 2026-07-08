#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init";
import { installWorkflow } from "./commands/workflow";
import { runDoctorCommand } from "./commands/doctor";
import { runUpdate } from "./commands/update";
import {
  startSession,
  listSessions,
  endSession,
  showSession,
  currentSession,
} from "./commands/session";
import { cliVersion } from "./core/config";
import { log } from "./core/logger";
import { templates } from "./registry/templates";
import { loadPlugins } from "./core/plugins";
import { checks } from "./doctor/checks";

const program = new Command();

program
  .name("foundruu")
  .description("FoundRuu CLI — AI開発を標準化するためのプラットフォーム")
  .version(cliVersion());

const wrap = async (fn: () => void | Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    // Ctrl+C でプロンプトを中断した場合は静かに終了する
    if ((err as Error).name === "ExitPromptError") {
      process.exitCode = 130;
      return;
    }
    log.error((err as Error).message);
    process.exitCode = 1;
  }
};

program
  .command("init")
  .description("AI開発環境（テンプレート / Workflow / Rules / Doctor設定）を一括導入する")
  .option("-t, --template <id>", "使用するテンプレートID（未指定なら対話で選択）")
  .option("-n, --name <name>", "プロジェクト名（デフォルト: ディレクトリ名）")
  .option("-d, --description <text>", "プロジェクトの説明")
  .option("-f, --features <list>", "導入する feature をカンマ区切りで指定(例: docker,vitest)")
  .option("-y, --yes", "対話プロンプトを出さずデフォルト値で実行する")
  .action(
    async (opts: {
      template?: string;
      name?: string;
      description?: string;
      features?: string;
      yes?: boolean;
    }) => {
      await wrap(() => runInit(process.cwd(), opts));
    }
  );

const workflow = program.command("workflow").description("Workflow / Prompt / Rules を管理する");
workflow
  .command("install")
  .description("Workflow / Prompt / Rules（.ai/）のみを既存リポジトリへ導入する")
  .action(() => {
    wrap(() => installWorkflow(process.cwd()));
  });

program
  .command("doctor")
  .description("リポジトリがAI開発可能な状態か診断する（.foundruurc でカスタマイズ可能）")
  .option("--json", "JSON形式で出力する")
  .option("--fix", "修復可能な項目(README / LICENSE / .gitignore / .env.example)を自動生成する")
  .option("--deep", "docs/ と git 差分から AI開発プロセスの品質をスコア診断する")
  .option("--since <ref>", "--deep の差分比較基準", "main")
  .option("--report <dir>", "--deep のレポート(md/html/json)を書き出すディレクトリ")
  .option("--markdown", "--deep の結果を Markdown で標準出力する(PR コメント用)")
  .action(
    async (opts: {
      json?: boolean;
      fix?: boolean;
      deep?: boolean;
      since?: string;
      report?: string;
      markdown?: boolean;
    }) => {
      await wrap(() => runDoctorCommand(process.cwd(), opts));
    }
  );

program
  .command("onboard")
  .description(
    "リポジトリのルール・ワークフロー・セッション・健全性をまとめたオンボーディングサマリを出力する"
  )
  .action(async () => {
    const { runOnboard } = await import("./commands/onboard.js");
    await wrap(() => runOnboard(process.cwd()));
  });

const rules = program
  .command("rules")
  .description("AI開発の規約(.ai/rules)を管理する(レビュー指摘の規約化)");
rules
  .command("add <text>")
  .description("レビュー指摘等を規約として .ai/rules へ追記する(再発防止)")
  .option("--file <name>", "追記先のルールファイル名(デフォルト: review-feedback.md)")
  .action(async (text: string, opts: { file?: string }) => {
    const { addRule } = await import("./commands/rules.js");
    await wrap(() => addRule(process.cwd(), text, opts));
  });
rules
  .command("list")
  .description("ルールファイルの一覧と件数を表示する")
  .action(async () => {
    const { listRules } = await import("./commands/rules.js");
    await wrap(() => listRules(process.cwd()));
  });

const hooks = program
  .command("hooks")
  .description("git フックを管理する(コミット前に doctor を実行するガードレール)");
hooks
  .command("install")
  .description("pre-commit フックを導入する(doctor fail でコミットを中止)")
  .option("-f, --force", "既存の pre-commit フックを上書きする")
  .action(async (opts: { force?: boolean }) => {
    const { installHooks } = await import("./commands/hooks.js");
    await wrap(() => installHooks(process.cwd(), opts));
  });
hooks
  .command("uninstall")
  .description("FoundRuu が導入した pre-commit フックを削除する")
  .action(async () => {
    const { uninstallHooks } = await import("./commands/hooks.js");
    await wrap(() => uninstallHooks(process.cwd()));
  });
hooks
  .command("status")
  .description("pre-commit フックの導入状態を表示する")
  .action(async () => {
    const { hooksStatus } = await import("./commands/hooks.js");
    await wrap(() => hooksStatus(process.cwd()));
  });

program
  .command("update")
  .description(
    "Workflow / Prompt / Rules を最新へ更新する（GitHub から取得、失敗時は同梱アセット）"
  )
  .option("-f, --force", "ユーザー編集済みファイルも上書きする")
  .option("--diff", "差分の表示のみで書き込まない")
  .option("--local", "GitHub から取得せず CLI 同梱アセットを使う")
  .option(
    "--only <paths...>",
    "指定パスのみ更新する(例: --only .ai/workflows .ai/prompts/session-workflow.md)"
  )
  .action(async (opts: { force?: boolean; diff?: boolean; local?: boolean; only?: string[] }) => {
    await wrap(() => runUpdate(process.cwd(), opts));
  });

program
  .command("mcp")
  .description("MCP サーバーを起動する(AIエージェントから doctor / session 等をツールとして利用)")
  .action(async () => {
    const { runMcpServer } = await import("./commands/mcp.js");
    await wrap(() => runMcpServer(process.cwd()));
  });

const session = program.command("session").description("AI開発セッションを管理する");
session
  .command("start <name>")
  .description("セッション作業ファイル一式を .ai/sessions/<name>/ に作成する")
  .action(async (name: string) => {
    await wrap(() => startSession(process.cwd(), name));
  });
session
  .command("list")
  .description("既存セッションを一覧表示する")
  .action(async () => {
    await wrap(() => listSessions(process.cwd()));
  });
session
  .command("show [name]")
  .description("セッションの状態とファイルを表示する（name 省略で現在のセッション）")
  .action(async (name?: string) => {
    await wrap(() => showSession(process.cwd(), name));
  });
session
  .command("end [name]")
  .description("セッションを完了として記録する（name 省略で現在のセッション）")
  .action(async (name?: string) => {
    await wrap(() => endSession(process.cwd(), name));
  });
session
  .command("current")
  .description("現在のセッションを表示する")
  .action(async () => {
    await wrap(() => currentSession(process.cwd()));
  });

program
  .command("templates")
  .description("利用可能なテンプレートを一覧表示する")
  .action(() => {
    for (const t of templates) {
      log.info(`  ${t.id.padEnd(16)} ${t.label}${t.status === "planned" ? "（準備中）" : ""}`);
    }
  });

// プラグイン読み込み(コマンド・doctor チェックの拡張)
const loadedPlugins = loadPlugins(process.cwd(), {
  program,
  addDoctorCheck: (check) => checks.push(check),
  log,
});

program
  .command("plugins")
  .description("読み込まれているプラグインを一覧表示する")
  .action(() => {
    if (loadedPlugins.length === 0) {
      log.info("プラグインは読み込まれていません。");
      log.info(
        "  node_modules の foundruu-plugin-* または foundruu.json の plugins で追加できます。"
      );
      return;
    }
    for (const p of loadedPlugins) {
      log.info(`  ${p.name.padEnd(24)} ${p.source}`);
    }
  });

program.parse();
