import pc from "picocolors";
import { runDoctor } from "../doctor/runner";
import { log } from "../core/logger";

export function runDoctorCommand(cwd: string, options: { json?: boolean }): void {
  const report = runDoctor(cwd);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    log.info(pc.bold("FoundRuu Doctor — リポジトリ健全性診断\n"));
    let currentCategory = "";
    for (const r of report.results) {
      if (r.category !== currentCategory) {
        currentCategory = r.category;
        log.info(pc.bold(`[${currentCategory}]`));
      }
      const mark =
        r.status === "pass" ? pc.green("✔") : r.status === "warn" ? pc.yellow("⚠") : pc.red("✖");
      log.info(`  ${mark} ${r.label}`);
      if (r.hint) log.info(pc.dim(`      → ${r.hint}`));
    }
    log.info("");
    log.info(
      `結果: ${pc.green(`${report.passed} pass`)} / ${pc.yellow(`${report.warned} warn`)} / ${pc.red(`${report.failed} fail`)}`
    );
    log.info(
      report.ok
        ? pc.green("AIが安全に開発できる状態です。")
        : pc.red("AI開発を始める前に fail 項目の解消を推奨します。")
    );
  }

  if (!report.ok) process.exitCode = 1;
}
