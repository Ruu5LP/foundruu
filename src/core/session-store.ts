import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * AI開発セッションの状態管理（永続化層）。
 * メタ情報はセッションディレクトリの外に置き、作業ファイルを汚さない。
 *   .ai/sessions/.current            … 現在のセッション名
 *   .ai/sessions/.status/<name>.json … 各セッションの開始/終了時刻
 */

export interface SessionStatus {
  startedAt: string;
  endedAt?: string;
}

/** .ai を持つリポジトリルートを特定する(git toplevel 優先、なければ上方向へ探索) */
export function findAiRoot(cwd: string): string | null {
  try {
    const top = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { stdio: "pipe" })
      .toString()
      .trim();
    if (fs.existsSync(path.join(top, ".ai"))) return top;
  } catch {
    // git 管理外は上方向探索へフォールバック
  }
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".ai"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireAiRoot(cwd: string): string {
  const root = findAiRoot(cwd);
  if (!root) {
    throw new Error(
      ".ai ディレクトリが見つかりません。foundruu workflow install で導入するか、リポジトリ内で実行してください。"
    );
  }
  return root;
}

export const sessionsRoot = (root: string): string => path.join(root, ".ai", "sessions");
export const sessionDir = (root: string, name: string): string =>
  path.join(sessionsRoot(root), name);

const currentFile = (root: string): string => path.join(sessionsRoot(root), ".current");
const statusFile = (root: string, name: string): string =>
  path.join(sessionsRoot(root), ".status", `${name}.json`);

export function readCurrent(root: string): string | null {
  const file = currentFile(root);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8").trim() || null;
}

export function setCurrent(root: string, name: string): void {
  fs.mkdirSync(sessionsRoot(root), { recursive: true });
  fs.writeFileSync(currentFile(root), `${name}\n`);
}

export function clearCurrent(root: string): void {
  const file = currentFile(root);
  if (fs.existsSync(file)) fs.rmSync(file);
}

export function readStatus(root: string, name: string): SessionStatus | null {
  const file = statusFile(root, name);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SessionStatus;
  } catch {
    return null;
  }
}

export function writeStatus(root: string, name: string, status: SessionStatus): void {
  fs.mkdirSync(path.dirname(statusFile(root, name)), { recursive: true });
  fs.writeFileSync(statusFile(root, name), JSON.stringify(status, null, 2) + "\n");
}
