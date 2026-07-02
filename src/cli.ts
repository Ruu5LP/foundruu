#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init";
import { installWorkflow } from "./commands/workflow";
import { runDoctorCommand } from "./commands/doctor";
import { runUpdate } from "./commands/update";
import { cliVersion } from "./core/config";
import { log } from "./core/logger";
import { templates } from "./registry/templates";

const program = new Command();

program
  .name("foundruu")
  .description("FoundRuu CLI — AI開発を標準化するためのプラットフォーム")
  .version(cliVersion());

const wrap = (fn: () => void): void => {
  try {
    fn();
  } catch (err) {
    log.error((err as Error).message);
    process.exitCode = 1;
  }
};

program
  .command("init")
  .description("AI開発環境（テンプレート / Workflow / Rules / Doctor設定）を一括導入する")
  .option("-t, --template <id>", "使用するテンプレートID", "typescript")
  .option("-n, --name <name>", "プロジェクト名（デフォルト: ディレクトリ名）")
  .option("-d, --description <text>", "プロジェクトの説明")
  .action((opts: { template: string; name?: string; description?: string }) => {
    wrap(() => runInit(process.cwd(), opts));
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
  .description("リポジトリがAI開発可能な状態か診断する")
  .option("--json", "JSON形式で出力する")
  .action((opts: { json?: boolean }) => {
    wrap(() => runDoctorCommand(process.cwd(), opts));
  });

program
  .command("update")
  .description("Workflow / Prompt / Rules を最新へ更新する")
  .option("-f, --force", "既存ファイルも上書きする")
  .action((opts: { force?: boolean }) => {
    wrap(() => runUpdate(process.cwd(), opts));
  });

program
  .command("templates")
  .description("利用可能なテンプレートを一覧表示する")
  .action(() => {
    for (const t of templates) {
      log.info(`  ${t.id.padEnd(16)} ${t.label}${t.status === "planned" ? "（準備中）" : ""}`);
    }
  });

program.parse();
