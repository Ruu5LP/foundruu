import { execFileSync } from "child_process";
import { scanDocs } from "./deep-docs";
import { CATEGORY_LABELS, DocCategory, deepRules } from "./deep-rules";
import { collectTrace, TraceReport } from "./deep-trace";

/**
 * DevDoctor (Ruu5LP/DevDoctor) のスコアリングルールを移植した diff ベース品質診断。
 * ルール定義は deep-rules.ts、ドキュメント収集は deep-docs.ts、
 * トレーサビリティ検証は deep-trace.ts に分かれており、ここは diff 収集と採点を担う。
 */

export { deepRules } from "./deep-rules";
export type { DeepRule, DocCategory } from "./deep-rules";
export { scanDocs } from "./deep-docs";
export { collectTrace } from "./deep-trace";
export type { TraceReport } from "./deep-trace";

export interface CategoryScore {
  category: DocCategory;
  label: string;
  docPath?: string;
  score: number;
  failed: { id?: string; label: string; improvement: string }[];
}

export interface DeepReport {
  since: string;
  diff: { files: number; insertions: number; deletions: number; untracked: number };
  scores: CategoryScore[];
  overall: number;
  /** 要件・設計とコードの紐づけ検証（総合スコアには算入しない） */
  trace: TraceReport;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { stdio: "pipe" }).toString();
}

function collectDiff(
  cwd: string,
  since: string
): { diff: DeepReport["diff"]; changedFiles: string[] } {
  const base = git(cwd, ["merge-base", since, "HEAD"]).trim();
  const numstat = git(cwd, ["diff", "--numstat", base]);
  let insertions = 0;
  let deletions = 0;
  const changedFiles: string[] = [];
  for (const line of numstat.split("\n")) {
    const matched = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!matched) continue;
    changedFiles.push(matched[3]);
    if (matched[1] !== "-") insertions += Number(matched[1]);
    if (matched[2] !== "-") deletions += Number(matched[2]);
  }
  const files = changedFiles.length;
  // 未追跡の新規ファイルは diff に出ないが、設計との突き合わせでは変更として扱う
  const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter((f) => f.length > 0);
  return {
    diff: { files, insertions, deletions, untracked: untracked.length },
    changedFiles: [...changedFiles, ...untracked],
  };
}

export function runDeepDoctor(
  cwd: string,
  since: string,
  disabledRules: string[] = [],
  traceExcludes: string[] = []
): DeepReport {
  const { diff, changedFiles } = collectDiff(cwd, since);
  const docs = scanDocs(cwd);
  // 未知の ID は無視する(将来ルールが削除されても設定がエラーにならないように)
  const disabled = new Set(disabledRules);

  const scores: CategoryScore[] = (Object.keys(CATEGORY_LABELS) as DocCategory[]).map(
    (category) => {
      const doc = docs.get(category);
      const rules = deepRules.filter((r) => r.category === category && !disabled.has(r.id));
      // 全観点が無効化されたカテゴリは採点対象外(未計測)とする
      if (rules.length === 0) {
        return { category, label: CATEGORY_LABELS[category], score: 0, failed: [] };
      }
      if (!doc) {
        return {
          category,
          label: CATEGORY_LABELS[category],
          score: 0,
          failed: [
            {
              label: `${category} ドキュメントが見つからない`,
              improvement: `docs/ または .ai/sessions/<session>/ に ${category}.md を作成する`,
            },
          ],
        };
      }
      const failed = rules
        .filter((r) => !r.pattern.test(doc.content))
        .map((r) => ({ id: r.id, label: r.label, improvement: r.improvement }));
      return {
        category,
        label: CATEGORY_LABELS[category],
        docPath: doc.path,
        score: Math.round(((rules.length - failed.length) / rules.length) * 100),
        failed,
      };
    }
  );

  // 該当ドキュメントが存在しないカテゴリ(docPath なし)は「未計測」とし、総合スコアに算入しない。
  // 「ドキュメントの有無」は基本の doctor が見る領域で、--deep は「ある文書の中身の質」を測るため、
  // 文書が無いことを 0 点として二重に減点しない(well-documented でも 0 点になる問題の対策)。
  const measured = scores.filter((s) => s.docPath !== undefined);
  const overall = measured.length
    ? Math.round(measured.reduce((sum, s) => sum + s.score, 0) / measured.length)
    : 0;
  const trace = collectTrace(cwd, changedFiles, docs, traceExcludes);
  return { since, diff, scores, overall, trace };
}
