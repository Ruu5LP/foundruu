import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { readRc } from "./rc";
import { DoctorCheck } from "./types";

/**
 * 保守運用のためのチェック(時間経過でドキュメントが腐るのを検知する)。
 * git 履歴を使うため、git 管理外・履歴が読めない場合は対象外(pass)として扱う。
 */

/** ドキュメント鮮度のデフォルト: docs/ 未更新のまま src/ 等がこの回数コミットされたら warn */
const DEFAULT_MAX_COMMITS = 10;
const DEFAULT_DOC_PATHS = ["docs"];
const DEFAULT_SOURCE_PATHS = ["src", "app", "lib", "packages"];

function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { stdio: "pipe" })
    .toString()
    .trim();
}

/** docs が最後に更新されてからのソース変更コミット数。計測不能なら null */
export function staleSourceCommits(
  cwd: string,
  docPaths: string[],
  sourcePaths: string[]
): number | null {
  try {
    const existingDocs = docPaths.filter((p) => fs.existsSync(path.join(cwd, p)));
    const existingSources = sourcePaths.filter((p) => fs.existsSync(path.join(cwd, p)));
    if (existingDocs.length === 0 || existingSources.length === 0) return null;
    const lastDocCommit = git(cwd, ["log", "-1", "--format=%H", "--", ...existingDocs]);
    if (!lastDocCommit) return null; // docs がまだ一度もコミットされていない
    const count = git(cwd, [
      "rev-list",
      "--count",
      `${lastDocCommit}..HEAD`,
      "--",
      ...existingSources,
    ]);
    return Number(count);
  } catch {
    return null; // git 管理外など
  }
}

/** docs/architecture.md 等の最終コミット日時(epoch ms)。無ければ null */
function lastCommitTime(cwd: string, relPath: string): number | null {
  try {
    const iso = git(cwd, ["log", "-1", "--format=%cI", "--", relPath]);
    return iso ? Date.parse(iso) : null;
  } catch {
    return null;
  }
}

/** docs へ昇格されていない可能性のある終了済みセッションの design.md を列挙する */
export function unpromotedDesigns(cwd: string): string[] {
  const statusDir = path.join(cwd, ".ai", "sessions", ".status");
  if (!fs.existsSync(statusDir)) return [];
  const architectureTime = lastCommitTime(cwd, "docs/architecture.md");
  const results: string[] = [];
  for (const entry of fs.readdirSync(statusDir)) {
    if (!entry.endsWith(".json")) continue;
    const name = entry.slice(0, -".json".length);
    let endedAt: string | undefined;
    try {
      endedAt = (
        JSON.parse(fs.readFileSync(path.join(statusDir, entry), "utf8")) as { endedAt?: string }
      ).endedAt;
    } catch {
      continue;
    }
    if (!endedAt) continue; // 進行中は対象外
    const designFile = path.join(cwd, ".ai", "sessions", name, "design.md");
    if (!fs.existsSync(designFile) || fs.readFileSync(designFile, "utf8").trim().length === 0) {
      continue;
    }
    // セッション終了後に docs/architecture.md が一度も更新されていなければ昇格漏れの可能性
    if (architectureTime === null || architectureTime < Date.parse(endedAt)) {
      results.push(name);
    }
  }
  return results;
}

/** 保守運用カテゴリのチェック一覧(checks.ts から結合される) */
export const maintenanceChecks: DoctorCheck[] = [
  {
    id: "docs-freshness",
    label: "ドキュメント鮮度",
    category: "保守運用",
    severity: "warn",
    hint: "docs/ が最後に更新されてからソースの変更が続いています。設計ドキュメントが現状と合っているか見直してください（しきい値は .foundruurc の doctor.freshness.maxCommits で変更可能）",
    check: (ctx) => {
      const rc = readRc(ctx.cwd);
      const freshness = rc.doctor?.freshness;
      const count = staleSourceCommits(
        ctx.cwd,
        freshness?.docs ?? DEFAULT_DOC_PATHS,
        freshness?.source ?? DEFAULT_SOURCE_PATHS
      );
      if (count === null) return true; // 計測不能は対象外
      return count <= (freshness?.maxCommits ?? DEFAULT_MAX_COMMITS);
    },
  },
  {
    id: "design-promotion",
    label: "設計判断の昇格",
    category: "保守運用",
    severity: "warn",
    hint: "終了済みセッションの design.md に docs/architecture.md へ未昇格の設計判断がある可能性があります。恒久的な判断は docs/ へ反映してください（foundruu session show <name> で確認）",
    check: (ctx) => unpromotedDesigns(ctx.cwd).length === 0,
  },
];
