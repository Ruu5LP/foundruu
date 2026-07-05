import fs from "fs";
import path from "path";
import { DeepReport } from "../doctor/deep";
import { log } from "../core/logger";

interface HistoryEntry {
  timestamp: string;
  report: DeepReport;
}

/** reports ディレクトリの foundruu-deep-report-*.json を時系列で読み込む */
export function loadHistory(dir: string): HistoryEntry[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^foundruu-deep-report-.*\.json$/.test(f))
    .sort()
    .map((f) => ({
      timestamp: f.replace(/^foundruu-deep-report-/, "").replace(/\.json$/, ""),
      report: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as DeepReport,
    }));
}

function trendSvg(history: HistoryEntry[]): string {
  const w = 760;
  const h = 220;
  const pad = 30;
  const n = history.length;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (score: number) => h - pad - (score * (h - pad * 2)) / 100;
  const points = history.map((e, i) => `${x(i)},${y(e.report.overall)}`).join(" ");
  const dots = history
    .map(
      (e, i) =>
        `<circle cx="${x(i)}" cy="${y(e.report.overall)}" r="4" fill="#4c6ef5"><title>${e.timestamp}: ${e.report.overall}点</title></circle>`
    )
    .join("");
  const gridLines = [0, 50, 80, 100]
    .map(
      (v) =>
        `<line x1="${pad}" y1="${y(v)}" x2="${w - pad}" y2="${y(v)}" stroke="#e0e0e0"/>` +
        `<text x="4" y="${y(v) + 4}" font-size="10" fill="#888">${v}</text>`
    )
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="総合スコア推移">
  ${gridLines}
  <polyline points="${points}" fill="none" stroke="#4c6ef5" stroke-width="2"/>
  ${dots}
</svg>`;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderDashboard(history: HistoryEntry[]): string {
  const latest = history[history.length - 1];
  const color = (s: number) => (s >= 80 ? "#22a06b" : s >= 50 ? "#b38600" : "#c9372c");
  const categoryRows = latest.report.scores
    .map((s) => {
      const prev =
        history.length > 1
          ? history[history.length - 2].report.scores.find((p) => p.category === s.category)
          : undefined;
      const delta = prev ? s.score - prev.score : 0;
      const deltaLabel = prev
        ? delta > 0
          ? ` (▲${delta})`
          : delta < 0
            ? ` (▼${-delta})`
            : " (±0)"
        : "";
      return `<tr><td>${s.label}</td><td style="color:${color(s.score)};font-weight:bold">${s.score}点${deltaLabel}</td><td>${s.docPath ?? "（なし）"}</td></tr>`;
    })
    .join("");

  // 改善アクション: 各カテゴリの未達項目(label → improvement)を、スコアの低い順に並べる。
  // 「何をすればスコアが上がるか」を具体的に示す。
  const actionable = [...latest.report.scores]
    .filter((s) => s.failed.length > 0)
    .sort((a, b) => a.score - b.score);
  const actionsHtml = actionable.length
    ? actionable
        .map(
          (s) =>
            `<h3>${esc(s.label)} <span class="meta">(${s.score}点${s.docPath ? ` / ${esc(s.docPath)}` : ""})</span></h3>\n` +
            `<ul>` +
            s.failed
              .map((f) => `<li><strong>${esc(f.label)}</strong> — ${esc(f.improvement)}</li>`)
              .join("") +
            `</ul>`
        )
        .join("\n")
    : `<p>改善アクションはありません 🎉</p>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>FoundRuu Dashboard</title>
<style>
  body { font-family: -apple-system, "Hiragino Sans", sans-serif; margin: 2rem auto; max-width: 50rem; padding: 0 1rem; color: #1c1c1c; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; }
  th { background: #f5f5f5; }
  .overall { font-size: 2.5rem; font-weight: bold; color: ${color(latest.report.overall)}; }
  .meta { color: #666; font-weight: normal; }
  h3 { margin: 1.2rem 0 .3rem; }
  ul { line-height: 1.7; margin-top: .2rem; }
</style>
</head>
<body>
<h1>FoundRuu Dashboard</h1>
<p class="meta">レポート ${history.length}件 / 最新: ${latest.timestamp}</p>
<p class="overall">総合スコア: ${latest.report.overall}点</p>
<h2>スコア推移</h2>
${trendSvg(history)}
<h2>最新のカテゴリ別スコア</h2>
<table>
  <tr><th>カテゴリ</th><th>スコア（前回比）</th><th>ドキュメント</th></tr>
  ${categoryRows}
</table>
<h2>改善アクション（最新レポート）</h2>
${actionsHtml}
</body>
</html>
`;
}

export function runDashboard(cwd: string, options: { dir?: string; out?: string }): void {
  const dir = path.resolve(cwd, options.dir ?? "reports");
  const history = loadHistory(dir);
  if (history.length === 0) {
    log.warn(
      `${path.relative(cwd, dir) || "."} に deep レポートがありません。まず foundruu doctor --deep --report ${options.dir ?? "reports"} を実行してください。`
    );
    process.exitCode = 1;
    return;
  }
  const out = path.resolve(cwd, options.out ?? path.join(dir, "index.html"));
  fs.writeFileSync(out, renderDashboard(history));
  log.success(`ダッシュボードを生成しました: ${out}(レポート${history.length}件)`);
}
