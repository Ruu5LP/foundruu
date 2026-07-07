import fs from "fs";
import path from "path";
import { DeepReport } from "./deep";

/** doctor --deep のレポートを md / html / json で書き出し、生成ファイルのパスを返す */
export function writeDeepReports(report: DeepReport, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(outDir, `foundruu-deep-report-${stamp}`);

  const files = [
    writeFile(`${base}.json`, JSON.stringify(report, null, 2) + "\n"),
    writeFile(`${base}.md`, renderMarkdown(report)),
    writeFile(`${base}.html`, renderHtml(report)),
  ];
  return files;
}

function writeFile(file: string, content: string): string {
  fs.writeFileSync(file, content);
  return file;
}

function renderMarkdown(report: DeepReport): string {
  const hasMeasured = report.scores.some((s) => s.docPath !== undefined);
  const scoreText = (s: DeepReport["scores"][number]): string =>
    s.docPath !== undefined ? `${s.score}点` : "未計測";
  const lines: string[] = [
    "# FoundRuu Deep Report",
    "",
    `- 生成日時: ${new Date().toISOString()}`,
    `- 比較基準: \`${report.since}\``,
    `- 差分: ${report.diff.files}ファイル +${report.diff.insertions} -${report.diff.deletions}${report.diff.untracked > 0 ? `（ほか未追跡 ${report.diff.untracked} ファイル）` : ""}`,
    `- **総合スコア: ${hasMeasured ? `${report.overall}点` : "未計測"}**`,
    "",
    "| カテゴリ | スコア | ドキュメント |",
    "|---|---|---|",
    ...report.scores.map((s) => `| ${s.label} | ${scoreText(s)} | ${s.docPath ?? "（なし）"} |`),
    "",
  ];
  for (const s of report.scores) {
    if (s.failed.length === 0) continue;
    lines.push(`## ${s.label} の改善案`, "");
    for (const f of s.failed) {
      lines.push(`- **${f.label}** — ${f.improvement}`);
    }
    lines.push("");
  }
  lines.push("## トレーサビリティ", "");
  const t = report.trace;
  if (t.checkedFiles === 0) {
    lines.push("- 突き合わせ対象の変更ファイルなし");
  } else if (t.designPath === undefined) {
    lines.push("- 設計ドキュメントが無いため変更ファイルとの突き合わせは未実施");
  } else if (t.undocumented.length > 0) {
    lines.push(
      `- ⚠ 設計(\`${t.designPath}\`)に記載のない変更ファイル: ${t.undocumented.join(", ")}`
    );
  } else {
    lines.push(`- ✔ 変更ファイル ${t.checkedFiles} 件はすべて設計(\`${t.designPath}\`)に記載あり`);
  }
  if (t.acceptanceIds.length > 0) {
    if (t.untestedIds.length > 0)
      lines.push(`- ⚠ テスト観点から未参照の受け入れ条件: ${t.untestedIds.join(", ")}`);
    if (t.unplannedIds.length > 0)
      lines.push(`- ⚠ タスクから未参照の受け入れ条件: ${t.unplannedIds.join(", ")}`);
    if (t.untestedIds.length === 0 && t.unplannedIds.length === 0)
      lines.push(`- ✔ 受け入れ条件 ${t.acceptanceIds.length} 件はすべて参照済み`);
  } else {
    lines.push("- 受け入れ条件 ID (AC-n) は未使用");
  }
  lines.push("");
  return lines.join("\n");
}

function renderHtml(report: DeepReport): string {
  const color = (score: number) => (score >= 80 ? "#22a06b" : score >= 50 ? "#b38600" : "#c9372c");
  const hasMeasured = report.scores.some((s) => s.docPath !== undefined);
  const rows = report.scores
    .map((s) => {
      const scoreCell =
        s.docPath !== undefined
          ? `<td style="color:${color(s.score)};font-weight:bold">${s.score}点</td>`
          : `<td style="color:#666">未計測</td>`;
      return `
      <tr>
        <td>${escapeHtml(s.label)}</td>
        ${scoreCell}
        <td>${escapeHtml(s.docPath ?? "（なし）")}</td>
        <td><ul>${s.failed.map((f) => `<li><b>${escapeHtml(f.label)}</b> — ${escapeHtml(f.improvement)}</li>`).join("")}</ul></td>
      </tr>`;
    })
    .join("");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>FoundRuu Deep Report</title>
<style>
  body { font-family: -apple-system, "Hiragino Sans", sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; color: #1c1c1c; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  .overall { font-size: 2rem; font-weight: bold; color: ${hasMeasured ? color(report.overall) : "#666"}; }
</style>
</head>
<body>
<h1>FoundRuu Deep Report</h1>
<p>比較基準: <code>${escapeHtml(report.since)}</code> / 差分: ${report.diff.files}ファイル +${report.diff.insertions} -${report.diff.deletions}${report.diff.untracked > 0 ? `（ほか未追跡 ${report.diff.untracked} ファイル）` : ""}</p>
<p class="overall">総合スコア: ${hasMeasured ? `${report.overall}点` : "未計測"}</p>
<table>
  <tr><th>カテゴリ</th><th>スコア</th><th>ドキュメント</th><th>改善案</th></tr>
  ${rows}
</table>
<h2>トレーサビリティ</h2>
<ul>${traceItems(report)
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("")}</ul>
</body>
</html>
`;
}

function traceItems(report: DeepReport): string[] {
  const t = report.trace;
  const items: string[] = [];
  if (t.checkedFiles === 0) {
    items.push("突き合わせ対象の変更ファイルなし");
  } else if (t.designPath === undefined) {
    items.push("設計ドキュメントが無いため変更ファイルとの突き合わせは未実施");
  } else if (t.undocumented.length > 0) {
    items.push(`⚠ 設計(${t.designPath})に記載のない変更ファイル: ${t.undocumented.join(", ")}`);
  } else {
    items.push(`✔ 変更ファイル ${t.checkedFiles} 件はすべて設計(${t.designPath})に記載あり`);
  }
  if (t.acceptanceIds.length > 0) {
    if (t.untestedIds.length > 0)
      items.push(`⚠ テスト観点から未参照の受け入れ条件: ${t.untestedIds.join(", ")}`);
    if (t.unplannedIds.length > 0)
      items.push(`⚠ タスクから未参照の受け入れ条件: ${t.unplannedIds.join(", ")}`);
    if (t.untestedIds.length === 0 && t.unplannedIds.length === 0)
      items.push(`✔ 受け入れ条件 ${t.acceptanceIds.length} 件はすべて参照済み`);
  } else {
    items.push("受け入れ条件 ID (AC-n) は未使用");
  }
  return items;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
