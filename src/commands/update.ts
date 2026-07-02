import { cliVersion, readConfig } from "../core/config";
import { log } from "../core/logger";
import { installWorkflow } from "./workflow";

/**
 * Workflow / Prompt / Rules を CLI 同梱の最新アセットへ更新する。
 * - 通常: 未導入ファイルの追加のみ（ユーザー編集を保護）
 * - --force: 既存ファイルも最新で上書き
 * 将来: GitHub からの取得・バージョン比較・差分表示に拡張する（docs/roadmap.md 参照）
 */
export function runUpdate(cwd: string, options: { force?: boolean }): void {
  const config = readConfig(cwd);
  const current = cliVersion();

  if (!config?.workflow) {
    log.warn("このプロジェクトには Workflow が導入されていません。foundruu workflow install を実行してください。");
    process.exitCode = 1;
    return;
  }

  log.info(`導入済みバージョン: ${config.workflow.version} → CLI バージョン: ${current}`);
  if (config.workflow.version === current && !options.force) {
    log.success("すでに最新です。既存ファイルを上書きしたい場合は --force を指定してください。");
    return;
  }

  installWorkflow(cwd, { overwrite: options.force ?? config.workflow.version !== current });
  log.success("Workflow を更新しました。");
}
