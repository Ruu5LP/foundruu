import fs from "fs";
import path from "path";
import { CategoryDoc, latestSessionDir } from "./deep-docs";
import { DocCategory } from "./deep-rules";

/**
 * 要件・設計とコードの紐づけ（トレーサビリティ）検証。
 * 変更ファイルが設計に記載されているか、受け入れ条件がテスト・計画から参照されているかを見る。
 */

export interface TraceReport {
  /** 変更対象の突き合わせに使った設計ドキュメント（最新セッションの design.md を優先） */
  designPath?: string;
  /** 除外適用後の変更ファイル数 */
  checkedFiles: number;
  /** 設計に記載が見つからない変更ファイル */
  undocumented: string[];
  /** 要件から抽出した受け入れ条件 ID（AC-n） */
  acceptanceIds: string[];
  /** テスト観点から参照されていない受け入れ条件 ID */
  untestedIds: string[];
  /** タスクから参照されていない受け入れ条件 ID */
  unplannedIds: string[];
}

/** 突き合わせからデフォルトで除外するパターン（ドキュメント類・ロックファイル） */
const DEFAULT_TRACE_EXCLUDES = [".ai/**", "**/*.md", "*.md", "package-lock.json"];

function globToRegExp(glob: string): RegExp {
  const esc = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "<DIRS>")
    .replace(/\*\*/g, "<ANY>")
    .replace(/\*/g, "[^/]*")
    .replace(/<DIRS>/g, "(?:.*/)?")
    .replace(/<ANY>/g, ".*");
  return new RegExp(`^${esc}$`);
}

/** 設計ドキュメント内でファイルが言及されているか（フルパス / ディレクトリ接頭辞 / ファイル名） */
function mentionedInDesign(file: string, designContent: string): boolean {
  if (designContent.includes(file)) return true;
  const segments = file.split("/");
  for (let i = 2; i < segments.length; i++) {
    if (designContent.includes(segments.slice(0, i).join("/") + "/")) return true;
  }
  return designContent.includes(segments[segments.length - 1]);
}

const AC_ID_PATTERN = /\bAC-\d+\b/g;

/** 要件・設計とコードの紐づけを検証する */
export function collectTrace(
  cwd: string,
  changedFiles: string[],
  docs: Map<DocCategory, CategoryDoc>,
  excludes: string[] = []
): TraceReport {
  const patterns = [...DEFAULT_TRACE_EXCLUDES, ...excludes].map(globToRegExp);
  const targets = changedFiles.filter((f) => !patterns.some((p) => p.test(f)));

  // 変更対象の突き合わせは実装単位の設計である最新セッションの design.md を優先する
  let design: CategoryDoc | undefined;
  const session = latestSessionDir(cwd);
  if (session !== undefined) {
    const p = path.join(session, "design.md");
    if (fs.existsSync(path.join(cwd, p))) {
      const content = fs.readFileSync(path.join(cwd, p), "utf8");
      if (content.trim().length > 0) design = { path: p, content };
    }
  }
  design ??= docs.get("design");

  const undocumented =
    design !== undefined ? targets.filter((f) => !mentionedInDesign(f, design.content)) : [];

  const acceptanceIds = [...new Set(docs.get("requirements")?.content.match(AC_ID_PATTERN) ?? [])];
  const testContent = docs.get("test")?.content ?? "";
  const planContent = docs.get("plan")?.content ?? "";
  return {
    designPath: design?.path,
    checkedFiles: targets.length,
    undocumented,
    acceptanceIds,
    untestedIds: acceptanceIds.filter((id) => !testContent.includes(id)),
    unplannedIds: acceptanceIds.filter((id) => !planContent.includes(id)),
  };
}
