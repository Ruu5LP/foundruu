import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { readConfig } from "../core/config";
import { log } from "../core/logger";

const DEFAULT_CLOUD_REPO = "Ruu5LP/foundruu-cloud";

export interface CloudOptions {
  /** レポートのディレクトリ */
  dir?: string;
  /** 送信先リポジトリ(owner/repo) */
  repo?: string;
  /** プロジェクト名(デフォルト: foundruu.json の projectName かディレクトリ名) */
  project?: string;
}

function resolveToken(): string {
  for (const env of ["GH_TOKEN", "GITHUB_TOKEN"]) {
    if (process.env[env]) return process.env[env] as string;
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
export function latestReport(dir: string): { file: string; name: string } | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^foundruu-deep-report-.*\.json$/.test(f))
    .sort();
  if (files.length === 0) return null;
  const name = files[files.length - 1];
  return { file: path.join(dir, name), name };
}

/** cloud push コマンド本体。最新の deep レポートを Cloud リポジトリへ送信する */
export async function runCloudPush(cwd: string, options: CloudOptions): Promise<void> {
  const dir = path.resolve(cwd, options.dir ?? "reports");
  const report = latestReport(dir);
  if (!report) {
    throw new Error(
      `${options.dir ?? "reports"} に deep レポートがありません。まず foundruu doctor --deep --report ${options.dir ?? "reports"} を実行してください。`
    );
  }

  const config = readConfig(cwd) as { projectName?: string; cloud?: { repo?: string } } | null;
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
