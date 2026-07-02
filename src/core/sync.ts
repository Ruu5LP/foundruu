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

export function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
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
  options: { force?: boolean; dryRun?: boolean } = {}
): SyncResult {
  const { force = false, dryRun = false } = options;
  const plan: SyncPlanEntry[] = [];
  const hashes: FileHashes = {};

  for (const relPath of listFiles(srcDir).sort()) {
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

    const willWrite = status === "add" || status === "update" || (status === "user-modified" && force);
    if (willWrite && !dryRun) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    // 記録するハッシュ: 書き込んだ(または既に最新の)ファイルは srcHash、保護したファイルは従来の記録を維持
    hashes[relPath] =
      willWrite || status === "unchanged" ? srcHash : recorded[relPath] ?? hashFile(destPath);
  }

  return { plan, hashes };
}
