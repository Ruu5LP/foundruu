import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { log } from "../core/logger";

/**
 * AI開発セッション管理(dev-workflow の bin/ai-session を TypeScript へ移植)。
 * .ai/templates/session/ を元に .ai/sessions/<name>/ へ作業ファイル一式を作成する。
 */

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

function requireAiRoot(cwd: string): string {
  const root = findAiRoot(cwd);
  if (!root) {
    throw new Error(
      ".ai ディレクトリが見つかりません。foundruu workflow install で導入するか、リポジトリ内で実行してください。"
    );
  }
  return root;
}

export function startSession(cwd: string, name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`セッション名が不正です(英数字で始まり / や空白を含まないこと): ${name}`);
  }

  const root = requireAiRoot(cwd);
  const templateDir = path.join(root, ".ai", "templates", "session");
  if (!fs.existsSync(templateDir)) {
    throw new Error(`セッションテンプレートが見つかりません: ${path.relative(cwd, templateDir)}`);
  }

  const dest = path.join(root, ".ai", "sessions", name);
  if (fs.existsSync(dest)) {
    throw new Error(`セッションは既に存在します: .ai/sessions/${name}`);
  }

  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(templateDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    fs.copyFileSync(path.join(templateDir, file), path.join(dest, file));
  }

  log.success(`セッションを作成しました: .ai/sessions/${name}`);
  log.info("");
  log.info("作成ファイル:");
  for (const file of files.sort()) {
    log.info(`  - .ai/sessions/${name}/${file}`);
  }
  log.info("");
  log.info("次のステップ:");
  log.info("  1. requirements.md に要件を書く");
  log.info("  2. AI に .ai/prompts/session-workflow.md と requirements.md を渡す");
  log.info("  3. AI が「進める / 質問する」を判断します");
}

/** 既存セッション名の一覧を返す(MCP からも利用) */
export function sessionNames(cwd: string): string[] {
  const root = requireAiRoot(cwd);
  const sessionsDir = path.join(root, ".ai", "sessions");
  if (!fs.existsSync(sessionsDir)) return [];
  return fs
    .readdirSync(sessionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function listSessions(cwd: string): void {
  const sessions = sessionNames(cwd);

  if (sessions.length === 0) {
    log.info("セッションはまだありません。");
    log.info("  作成: foundruu session start <session-name>");
    return;
  }

  log.info("セッション一覧 (.ai/sessions/):");
  for (const name of sessions) {
    log.info(`  - ${name}`);
  }
}
