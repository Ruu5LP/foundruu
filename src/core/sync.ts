import crypto from "crypto";
import fs from "fs";
import path from "path";

export type FileHashes = Record<string, string>;

export interface SyncPlanEntry {
  relPath: string;
  status: "add" | "update" | "unchanged" | "user-modified";
}

export interface SyncResult {
  plan: SyncPlanEntry[];
  /** 書き込み後の管理ファイルハッシュ(foundruu.json へ記録する) */
  hashes: FileHashes;
}

/** ファイル内容の sha256 ハッシュを返す(ユーザー編集の検出に使う) */
export function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/** ディレクトリ配下の全ファイルを base からの相対パスで列挙する */
export function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

/** relPath が only 指定(完全一致 or ディレクトリ前置一致)に含まれるか */
export function matchesOnly(relPath: string, only: string[]): boolean {
  const normalized = relPath.split(path.sep).join("/");
  return only.some((o) => {
    const pattern = o.replace(/\/+$/, "");
    return normalized === pattern || normalized.startsWith(pattern + "/");
  });
}

/**
 * srcDir(最新アセット)を destDir へ同期する計画を立て、dryRun でなければ適用する。
 *
 * 判定(recorded = 前回導入時に記録したハッシュ):
 * - 導入先に無い                          → add
 * - 最新と同一                            → unchanged
 * - 導入先 == recorded(ユーザー未編集)    → update(安全に上書き)
 * - 導入先 != recorded(ユーザーが編集済み) → user-modified(force 時のみ上書き)
 * - recorded が無い(旧バージョン導入等)   → user-modified 扱いで保護
 */
export function syncTree(
  srcDir: string,
  destDir: string,
  recorded: FileHashes,
  options: { force?: boolean; dryRun?: boolean; only?: string[] } = {}
): SyncResult {
  const { force = false, dryRun = false, only } = options;
  const plan: SyncPlanEntry[] = [];
  const hashes: FileHashes = {};

  for (const relPath of listFiles(srcDir).sort()) {
    // --only 指定がある場合、対象外ファイルは記録ハッシュを維持したままスキップ
    if (only && only.length > 0 && !matchesOnly(relPath, only)) {
      if (recorded[relPath]) hashes[relPath] = recorded[relPath];
      continue;
    }
    const srcPath = path.join(srcDir, relPath);
    const destPath = path.join(destDir, relPath);
    const srcHash = hashFile(srcPath);

    let status: SyncPlanEntry["status"];
    if (!fs.existsSync(destPath)) {
      status = "add";
    } else {
      const destHash = hashFile(destPath);
      if (destHash === srcHash) status = "unchanged";
      else if (recorded[relPath] && destHash === recorded[relPath]) status = "update";
      else status = "user-modified";
    }
    plan.push({ relPath, status });

    const willWrite =
      status === "add" || status === "update" || (status === "user-modified" && force);
    if (willWrite && !dryRun) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    // 記録するハッシュ: 書き込んだ(または既に最新の)ファイルは srcHash、保護したファイルは従来の記録を維持
    hashes[relPath] =
      willWrite || status === "unchanged" ? srcHash : (recorded[relPath] ?? hashFile(destPath));
  }

  return { plan, hashes };
}
