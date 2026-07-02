import pc from "picocolors";
import { cliVersion, readConfig, writeConfig } from "../core/config";
import { fetchWorkflowAssets } from "../core/fetcher";
import { log } from "../core/logger";
import { syncTree, SyncPlanEntry } from "../core/sync";

export interface UpdateOptions {
  /** ユーザー編集済みファイルも上書きする */
  force?: boolean;
  /** 差分表示のみで書き込まない */
  diff?: boolean;
  /** GitHub から取得せず CLI 同梱アセットを使う */
  local?: boolean;
}

const STATUS_LABEL: Record<SyncPlanEntry["status"], string> = {
  add: pc.green("追加        "),
  update: pc.cyan("更新        "),
  unchanged: pc.dim("最新        "),
  "user-modified": pc.yellow("編集済み保護"),
};

/**
 * Workflow / Prompt / Rules を最新アセットへ同期する。
 * 導入時に記録したハッシュと比較し、ユーザーが編集したファイルは --force なしでは上書きしない。
 */
export function runUpdate(cwd: string, options: UpdateOptions): void {
  const config = readConfig(cwd);
  if (!config?.workflow) {
    log.warn("このプロジェクトには Workflow が導入されていません。foundruu workflow install を実行してください。");
    process.exitCode = 1;
    return;
  }

  const { root, source } = fetchWorkflowAssets({ local: options.local });
  log.info(
    `アセット取得元: ${source === "remote" ? "GitHub (Ruu5LP/RuunFoundry)" : "CLI 同梱"} / 導入済みバージョン: ${config.workflow.version}`
  );

  const recorded = config.workflow.files ?? {};
  const { plan, hashes } = syncTree(root, cwd, recorded, {
    force: options.force,
    dryRun: options.diff,
  });

  const changed = plan.filter((e) => e.status !== "unchanged");
  if (changed.length === 0) {
    log.success("すべて最新です。");
    return;
  }

  for (const entry of changed) {
    const label =
      entry.status === "user-modified" && options.force && !options.diff
        ? pc.red("強制上書き  ")
        : STATUS_LABEL[entry.status];
    log.info(`  ${label} ${entry.relPath}`);
  }

  const protectedCount = plan.filter((e) => e.status === "user-modified").length;
  if (options.diff) {
    log.info("");
    log.info("--diff のため書き込みは行っていません。適用するには foundruu update を実行してください。");
    return;
  }

  if (protectedCount > 0 && !options.force) {
    log.warn(`ユーザー編集済みのため保護したファイルが ${protectedCount}件あります(上書きは --force)。`);
  }

  config.workflow = {
    version: cliVersion(),
    installedAt: new Date().toISOString(),
    files: hashes,
  };
  writeConfig(cwd, config);
  log.success("Workflow を更新しました。");
}
