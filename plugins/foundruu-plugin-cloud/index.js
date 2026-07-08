const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * FoundRuu 公式プラグイン(計測・集約)。
 * doctor --deep のレポートを可視化・集約する 2 コマンドを追加する:
 *   - foundruu dashboard   … レポート履歴からスコア推移ダッシュボード(HTML)を生成
 *   - foundruu cloud push  … 最新レポートを FoundRuu Cloud リポジトリへ送信
 * 本体は「番人(守る)」に絞る方針のため、計測系はこのプラグインに分離している。
 */

const DEFAULT_CLOUD_REPO = "Ruu5LP/foundruu-cloud";

/** foundruu.json を読み込む。存在しなければ null */
function readConfig(cwd) {
  const file = path.join(cwd, "foundruu.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** GitHub トークンを環境変数 → gh CLI の順で解決する */
function resolveToken() {
  for (const env of ["GH_TOKEN", "GITHUB_TOKEN"]) {
    if (process.env[env]) return process.env[env];
  }
  try {
    return execFileSync("gh", ["auth", "token"], { stdio: "pipe" }).toString().trim();
  } catch {
    throw new Error(
      "GitHub トークンが見つかりません。gh auth login を実行するか GH_TOKEN を設定してください。"
    );
  }
}

/** reports ディレクトリの最新 deep レポート JSON を返す */
function latestReport(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((file) => /^foundruu-deep-report-.*\.json$/.test(file))
    .sort();
  if (files.length === 0) return null;
  const name = files[files.length - 1];
  return { file: path.join(dir, name), name };
}

/** cloud push コマンド本体。最新の deep レポートを Cloud リポジトリへ送信する */
async function runCloudPush(cwd, options, log) {
  const dir = path.resolve(cwd, options.dir ?? "reports");
  const report = latestReport(dir);
  if (!report) {
    throw new Error(
      `${options.dir ?? "reports"} に deep レポートがありません。まず foundruu doctor --deep --report ${options.dir ?? "reports"} を実行してください。`
    );
  }

  const config = readConfig(cwd);
  const repo = options.repo ?? config?.cloud?.repo ?? DEFAULT_CLOUD_REPO;
  const project = (options.project ?? config?.projectName ?? path.basename(cwd)).replace(
    /[^\w.-]/g,
    "-"
  );
  const destPath = `reports/${project}/${report.name}`;
  const token = resolveToken();

  const content = fs.readFileSync(report.file);
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${destPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Add deep report: ${project} (${report.name})`,
      content: content.toString("base64"),
    }),
  });

  if (res.status === 422) {
    log.warn("同名のレポートが既に送信されています。");
    return;
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`送信に失敗しました(HTTP ${res.status}): ${body}`);
  }
  log.success(`レポートを送信しました: ${repo}/${destPath}`);
  log.info(
    `ダッシュボード: https://${repo.split("/")[0].toLowerCase()}.github.io/${repo.split("/")[1]}/`
  );
}

/** reports ディレクトリの foundruu-deep-report-*.json を時系列で読み込む */
function loadHistory(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => /^foundruu-deep-report-.*\.json$/.test(file))
    .sort()
    .map((file) => ({
      timestamp: file.replace(/^foundruu-deep-report-/, "").replace(/\.json$/, ""),
      report: JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")),
    }));
}

/** スコア推移の折れ線 SVG を組み立てる */
function trendSvg(history) {
  const width = 760;
  const height = 220;
  const padding = 30;
  const count = history.length;
  const xAt = (index) =>
    count === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (count - 1);
  const yAt = (score) => height - padding - (score * (height - padding * 2)) / 100;
  const points = history
    .map((entry, index) => `${xAt(index)},${yAt(entry.report.overall)}`)
    .join(" ");
  const dots = history
    .map(
      (entry, index) =>
        `<circle cx="${xAt(index)}" cy="${yAt(entry.report.overall)}" r="4" fill="#4c6ef5"><title>${entry.timestamp}: ${entry.report.overall}点</title></circle>`
    )
    .join("");
  const gridLines = [0, 50, 80, 100]
    .map(
      (value) =>
        `<line x1="${padding}" y1="${yAt(value)}" x2="${width - padding}" y2="${yAt(value)}" stroke="#e0e0e0"/>` +
        `<text x="4" y="${yAt(value) + 4}" font-size="10" fill="#888">${value}</text>`
    )
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="総合スコア推移">
  ${gridLines}
  <polyline points="${points}" fill="none" stroke="#4c6ef5" stroke-width="2"/>
  ${dots}
</svg>`;
}

/** HTML への埋め込み用エスケープ */
const escapeHtml = (raw) => raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** レポート履歴からスコア推移ダッシュボード(HTML)を組み立てる */
function renderDashboard(history) {
  const latest = history[history.length - 1];
  const color = (score) => (score >= 80 ? "#22a06b" : score >= 50 ? "#b38600" : "#c9372c");
  const categoryRows = latest.report.scores
    .map((score) => {
      const prev =
        history.length > 1
          ? history[history.length - 2].report.scores.find(
              (prevScore) => prevScore.category === score.category
            )
          : undefined;
      const delta = prev ? score.score - prev.score : 0;
      const deltaLabel = prev
        ? delta > 0
          ? ` (▲${delta})`
          : delta < 0
            ? ` (▼${-delta})`
            : " (±0)"
        : "";
      const scoreCell =
        score.docPath !== undefined
          ? `<span style="color:${color(score.score)};font-weight:bold">${score.score}点${deltaLabel}</span>`
          : `<span class="meta">未計測</span>`;
      return `<tr><td>${score.label}</td><td>${scoreCell}</td><td>${score.docPath ?? "（なし）"}</td></tr>`;
    })
    .join("");

  // 計測できたカテゴリが1つも無ければ総合スコアは「未計測」表示にする(0点の誤解を避ける)
  const hasMeasured = latest.report.scores.some((score) => score.docPath !== undefined);
  const overallColor = hasMeasured ? color(latest.report.overall) : "#666";
  const overallText = hasMeasured ? `総合スコア: ${latest.report.overall}点` : "総合スコア: 未計測";

  // 改善アクション: 各カテゴリの未達項目(label → improvement)を、スコアの低い順に並べる。
  // 「何をすればスコアが上がるか」を具体的に示す。
  const actionable = [...latest.report.scores]
    .filter((score) => score.failed.length > 0)
    .sort((left, right) => left.score - right.score);
  const actionsHtml = actionable.length
    ? actionable
        .map(
          (score) =>
            `<h3>${escapeHtml(score.label)} <span class="meta">(${score.score}点${score.docPath ? ` / ${escapeHtml(score.docPath)}` : ""})</span></h3>\n` +
            `<ul>` +
            score.failed
              .map(
                (item) =>
                  `<li><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.improvement)}</li>`
              )
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
  .overall { font-size: 2.5rem; font-weight: bold; color: ${overallColor}; }
  .meta { color: #666; font-weight: normal; }
  h3 { margin: 1.2rem 0 .3rem; }
  ul { line-height: 1.7; margin-top: .2rem; }
</style>
</head>
<body>
<h1>FoundRuu Dashboard</h1>
<p class="meta">レポート ${history.length}件 / 最新: ${latest.timestamp}</p>
<p class="overall">${overallText}</p>
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

/** dashboard コマンド本体。履歴を読み込み HTML を書き出す */
function runDashboard(cwd, options, log) {
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

module.exports = {
  name: "cloud",
  register({ program, log }) {
    const cloud = program.command("cloud").description("FoundRuu Cloud(レポート集約)と連携する");
    cloud
      .command("push")
      .description("最新の deep レポートを Cloud リポジトリへ送信する")
      .option("--dir <dir>", "レポートのディレクトリ", "reports")
      .option("--repo <owner/repo>", "送信先リポジトリ(デフォルト: foundruu.json の cloud.repo)")
      .option("--project <name>", "プロジェクト名(デフォルト: foundruu.json の projectName)")
      .action(async (opts) => {
        // 本体 cli.ts の wrap と同じく、例外はメッセージ表示 + exitCode=1 に収める
        try {
          await runCloudPush(process.cwd(), opts, log);
        } catch (err) {
          log.error(err.message);
          process.exitCode = 1;
        }
      });

    program
      .command("dashboard")
      .description("doctor --deep のレポート履歴からスコア推移ダッシュボード(HTML)を生成する")
      .option("--dir <dir>", "レポートのディレクトリ", "reports")
      .option("--out <file>", "出力先HTML(デフォルト: <dir>/index.html)")
      .action((opts) => {
        runDashboard(process.cwd(), opts, log);
      });
  },
  // テスト・foundruu-cloud 側の再利用のためコマンド実装も公開する
  latestReport,
  runCloudPush,
  loadHistory,
  renderDashboard,
  runDashboard,
};
