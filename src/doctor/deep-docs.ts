import fs from "fs";
import path from "path";
import { CATEGORY_PATTERNS, DocCategory } from "./deep-rules";

/**
 * --deep 診断が採点対象とするドキュメントの収集。
 * docs/ ・リポジトリ直下・最新の .ai/sessions/ からカテゴリ別に集める。
 */

export interface CategoryDoc {
  path: string;
  content: string;
}

/** 最新セッションディレクトリの相対パスを返す（隠しディレクトリは除外） */
export function latestSessionDir(cwd: string): string | undefined {
  const sessionsDir = path.join(cwd, ".ai", "sessions");
  if (!fs.existsSync(sessionsDir)) return undefined;
  const sessions = fs
    .readdirSync(sessionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(sessionsDir, e.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return sessions.length > 0 ? path.join(".ai", "sessions", sessions[0].name) : undefined;
}

/** docs/ ・リポジトリ直下・最新の .ai/sessions/ からカテゴリ別ドキュメントを収集する */
export function scanDocs(cwd: string): Map<DocCategory, CategoryDoc> {
  const candidates: string[] = [];
  for (const dir of ["docs", "doc", "."]) {
    const abs = path.join(cwd, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isFile() && /\.(md|txt)$/i.test(entry.name)) {
        candidates.push(path.join(dir === "." ? "" : dir, entry.name));
      }
    }
  }
  // 最新セッション(mtime 順)のドキュメントも対象にする
  const latest = latestSessionDir(cwd);
  if (latest !== undefined) {
    for (const f of fs.readdirSync(path.join(cwd, latest))) {
      if (/\.md$/i.test(f)) candidates.push(path.join(latest, f));
    }
  }

  const found = new Map<DocCategory, CategoryDoc>();
  for (const relPath of candidates) {
    const category = CATEGORY_PATTERNS.find((p) =>
      p.pattern.test(path.basename(relPath))
    )?.category;
    if (!category || found.has(category)) continue;
    const content = fs.readFileSync(path.join(cwd, relPath), "utf8");
    if (content.trim().length > 0) found.set(category, { path: relPath, content });
  }
  return found;
}
