#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init";
import { installWorkflow } from "./commands/workflow";
import { runDoctorCommand } from "./commands/doctor";
import { runUpdate } from "./commands/update";
import { startSession, listSessions } from "./commands/session";
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
  .option("-y, --yes", "対話プロンプトを出さずデフォルト値で実行する")
  .action(async (opts: { template?: string; name?: string; description?: string; yes?: boolean }) => {
    await wrap(() => runInit(process.cwd(), opts));
  });

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
  .option("--deep", "docs/ と git 差分から AI開発プロセスの品質をスコア診断する")
  .option("--since <ref>", "--deep の差分比較基準", "main")
  .action(async (opts: { json?: boolean; deep?: boolean; since?: string }) => {
    await wrap(() => runDoctorCommand(process.cwd(), opts));
  });

program
  .command("update")
  .description("Workflow / Prompt / Rules を最新へ更新する（GitHub から取得、失敗時は同梱アセット）")
  .option("-f, --force", "ユーザー編集済みファイルも上書きする")
  .option("--diff", "差分の表示のみで書き込まない")
  .option("--local", "GitHub から取得せず CLI 同梱アセットを使う")
  .action(async (opts: { force?: boolean; diff?: boolean; local?: boolean }) => {
    await wrap(() => runUpdate(process.cwd(), opts));
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
      log.info("  node_modules の foundruu-plugin-* または foundruu.json の plugins で追加できます。");
      return;
    }
    for (const p of loadedPlugins) {
      log.info(`  ${p.name.padEnd(24)} ${p.source}`);
    }
  });

program.parse();
