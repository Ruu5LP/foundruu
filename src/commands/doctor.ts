import pc from "picocolors";
import { runDoctor, runDoctorFix } from "../doctor/runner";
import { runDeepDoctor } from "../doctor/deep";
import { renderMarkdown, writeDeepReports } from "../doctor/report";
import { readRc } from "../doctor/rc";
import { log } from "../core/logger";

export interface DoctorOptions {
  json?: boolean;
  deep?: boolean;
  since?: string;
  /** --deep レポート(md/html/json)の出力先ディレクトリ */
  report?: string;
  /** --deep の結果を Markdown で標準出力する(PR コメント用) */
  markdown?: boolean;
  /** 修復可能な項目を自動生成してから診断する */
  fix?: boolean;
}

function scoreColor(score: number): (s: string) => string {
  return score >= 80 ? pc.green : score >= 50 ? pc.yellow : pc.red;
}

function runDeep(cwd: string, options: DoctorOptions): void {
  const rc = readRc(cwd);
  const report = runDeepDoctor(
    cwd,
    options.since ?? "main",
    rc.doctor?.deep?.disable ?? [],
    rc.doctor?.deep?.trace?.exclude ?? []
  );
  if (options.report) {
    const files = writeDeepReports(report, options.report);
    for (const f of files) log.step(`レポート出力: ${f}`);
  }
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (options.markdown) {
    console.log(renderMarkdown(report));
    return;
  }
  log.info(pc.bold("FoundRuu Doctor --deep — AI開発プロセス品質診断\n"));
  const untrackedNote =
    report.diff.untracked > 0 ? `（ほか未追跡 ${report.diff.untracked} ファイル）` : "";
  log.info(
    `差分(${report.since} 基準): ${report.diff.files}ファイル +${report.diff.insertions} -${report.diff.deletions}${untrackedNote}\n`
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
  log.info(pc.bold("トレーサビリティ（要件・設計とコードの紐づけ）"));
  const trace = report.trace;
  if (trace.checkedFiles === 0) {
    log.info(pc.dim("  - 突き合わせ対象の変更ファイルがありません"));
  } else if (trace.designPath === undefined) {
    log.info(pc.dim("  - 設計ドキュメントが無いため、変更ファイルとの突き合わせは未実施です"));
  } else if (trace.undocumented.length > 0) {
    log.info(pc.yellow(`  ⚠ 設計(${trace.designPath})に記載のない変更ファイル:`));
    for (const file of trace.undocumented) log.info(pc.yellow(`      - ${file}`));
    log.info(pc.dim("      → 設計の「変更対象」を更新するか、意図的なら理由を追記してください"));
  } else {
    log.info(
      pc.green(
        `  ✔ 変更ファイル ${trace.checkedFiles} 件はすべて設計(${trace.designPath})に記載があります`
      )
    );
  }
  if (trace.acceptanceIds.length === 0) {
    log.info(
      pc.dim(
        "  - 受け入れ条件 ID (AC-n) が要件に見つかりません。完了条件に AC-1: 形式で書くとトレースできます"
      )
    );
  } else {
    if (trace.untestedIds.length > 0) {
      log.info(
        pc.yellow(`  ⚠ テスト観点から参照されていない受け入れ条件: ${trace.untestedIds.join(", ")}`)
      );
    }
    if (trace.unplannedIds.length > 0) {
      log.info(
        pc.yellow(`  ⚠ タスクから参照されていない受け入れ条件: ${trace.unplannedIds.join(", ")}`)
      );
    }
    if (trace.untestedIds.length === 0 && trace.unplannedIds.length === 0) {
      log.info(
        pc.green(
          `  ✔ 受け入れ条件 ${trace.acceptanceIds.length} 件はすべてタスク・テスト観点から参照されています`
        )
      );
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

/** doctor コマンド本体。--deep はスコア診断、--fix は自動修復後に通常診断へ続く */
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
