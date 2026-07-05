import pc from "picocolors";
import { runDoctor, runDoctorFix } from "../doctor/runner";
import { runDeepDoctor } from "../doctor/deep";
import { writeDeepReports } from "../doctor/report";
import { log } from "../core/logger";

export interface DoctorOptions {
  json?: boolean;
  deep?: boolean;
  since?: string;
  /** --deep レポート(md/html/json)の出力先ディレクトリ */
  report?: string;
  /** 修復可能な項目を自動生成してから診断する */
  fix?: boolean;
}

function scoreColor(score: number): (s: string) => string {
  return score >= 80 ? pc.green : score >= 50 ? pc.yellow : pc.red;
}

function runDeep(cwd: string, options: DoctorOptions): void {
  const report = runDeepDoctor(cwd, options.since ?? "main");
  if (options.report) {
    const files = writeDeepReports(report, options.report);
    for (const f of files) log.step(`レポート出力: ${f}`);
  }
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  log.info(pc.bold("FoundRuu Doctor --deep — AI開発プロセス品質診断\n"));
  log.info(
    `差分(${report.since} 基準): ${report.diff.files}ファイル +${report.diff.insertions} -${report.diff.deletions}\n`
  );
  for (const s of report.scores) {
    if (s.docPath === undefined) {
      // 該当ドキュメントが無い = 未計測(0点ではない)
      log.info(`${pc.dim("░".repeat(10))} ${pc.dim("未計測")} ${s.label}`);
    } else {
      const color = scoreColor(s.score);
      const bar = "█".repeat(Math.round(s.score / 10)).padEnd(10, "░");
      log.info(
        `${color(bar)} ${String(s.score).padStart(3)}点 ${s.label}${pc.dim(`(${s.docPath})`)}`
      );
    }
    for (const f of s.failed) {
      log.info(pc.dim(`    - ${f.label} → ${f.improvement}`));
    }
  }
  log.info("");
  if (report.scores.some((s) => s.docPath !== undefined)) {
    log.info(`総合スコア: ${scoreColor(report.overall)(pc.bold(`${report.overall}点`))}`);
  } else {
    log.info(pc.dim("総合スコア: 未計測（要件/設計/テスト/AI指示のドキュメントが見つかりません）"));
    log.info(
      pc.dim("  docs/ に requirements.md / design.md / test.md 等を用意すると計測されます。")
    );
  }
}

export function runDoctorCommand(cwd: string, options: DoctorOptions): void {
  if (options.deep) {
    runDeep(cwd, options);
    return;
  }

  if (options.fix) {
    const { fixed, unfixable } = runDoctorFix(cwd);
    if (fixed.length === 0) {
      log.info("自動修復できる項目はありませんでした。");
    } else {
      for (const f of fixed) log.success(f.message);
    }
    for (const u of unfixable) {
      log.warn(`手動対応が必要: ${u.label} → ${u.hint}`);
    }
    log.info("");
    // 修復後の状態を続けて診断表示する(下の通常フローへ)
  }

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
