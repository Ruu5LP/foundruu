import fs from "fs";
import path from "path";
import pc from "picocolors";
import { log } from "../core/logger";
import {
  clearCurrent,
  readCurrent,
  readStatus,
  requireAiRoot,
  sessionDir,
  setCurrent,
  writeStatus,
} from "../core/session-store";

/**
 * AI開発セッション管理(dev-workflow の bin/ai-session を TypeScript へ移植)。
 * .ai/templates/session/ を元に .ai/sessions/<name>/ へ作業ファイル一式を作成する。
 * 状態の読み書きは core/session-store.ts が担う。
 */

export { findAiRoot } from "../core/session-store";

/** name 省略時は現在のセッションを使う。どちらも無ければエラー */
function resolveSession(root: string, name: string | undefined, action: string): string {
  const target = name ?? readCurrent(root);
  if (!target) {
    throw new Error(`${action}するセッションを指定してください（現在のセッションがありません）。`);
  }
  if (!fs.existsSync(sessionDir(root, target))) {
    throw new Error(`セッションが見つかりません: ${target}`);
  }
  return target;
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

  writeStatus(root, name, { startedAt: new Date().toISOString() });
  setCurrent(root, name);

  log.success(`セッションを作成しました: .ai/sessions/${name}（現在のセッション）`);
  log.info("");
  log.info("作成ファイル:");
  for (const file of files.sort()) {
    log.info(`  - .ai/sessions/${name}/${file}`);
  }
  log.info("");
  log.info("次のステップ:");
  log.info("  1. requirements.md に要件を書く");
  log.info("     （まだ整理できていない場合は .ai/prompts/structure.md を AI に渡して構造化する）");
  log.info("  2. AI に .ai/prompts/session-workflow.md と requirements.md を渡す");
  log.info("  3. AI が「進める / 質問する」を判断します");
}

/** セッションを完了として記録する。name 省略時は現在のセッション */
export function endSession(cwd: string, name?: string): void {
  const root = requireAiRoot(cwd);
  const target = resolveSession(root, name, "終了");
  const status = readStatus(root, target) ?? { startedAt: new Date().toISOString() };
  if (status.endedAt) {
    log.info(`セッション ${target} は既に終了しています（${status.endedAt}）。`);
    return;
  }
  status.endedAt = new Date().toISOString();
  writeStatus(root, target, status);
  if (readCurrent(root) === target) clearCurrent(root);
  log.success(`セッションを終了しました: ${target}`);
  // セッションの設計は使い捨てだが、恒久的な設計判断は昇格しないと保守時に参照できなくなる
  const designFile = path.join(root, ".ai", "sessions", target, "design.md");
  if (fs.existsSync(designFile) && fs.readFileSync(designFile, "utf8").trim().length > 0) {
    log.info(
      pc.dim(
        "終了前チェック: design.md の恒久的な設計判断（構成・方針の変更）は docs/architecture.md 等へ反映しましたか？"
      )
    );
  }
}

/** セッションの状態と作業ファイルを表示する。name 省略時は現在のセッション */
export function showSession(cwd: string, name?: string): void {
  const root = requireAiRoot(cwd);
  const target = resolveSession(root, name, "表示");
  const status = readStatus(root, target);
  const state = status?.endedAt ? "完了" : "進行中";
  const current = readCurrent(root) === target ? "（現在のセッション）" : "";

  log.info(`セッション: ${target}（${state}）${current}`);
  if (status?.startedAt) log.info(`  開始: ${status.startedAt}`);
  if (status?.endedAt) log.info(`  終了: ${status.endedAt}`);
  log.info("  ファイル:");
  const files = fs
    .readdirSync(sessionDir(root, target))
    .filter((f) => f.endsWith(".md"))
    .sort();
  for (const file of files) {
    const empty = fs.readFileSync(path.join(sessionDir(root, target), file), "utf8").trim() === "";
    log.info(`    - ${file}${empty ? "（未記入）" : ""}`);
  }
}

/** 現在のセッションを表示する */
export function currentSession(cwd: string): void {
  const root = requireAiRoot(cwd);
  const current = readCurrent(root);
  if (!current) {
    log.info("現在のセッションはありません。");
    log.info("  作成: foundruu session start <session-name>");
    return;
  }
  log.info(`現在のセッション: ${current}`);
}

/** 既存セッション名の一覧を返す(MCP からも利用)。.current / .status 等は除外 */
export function sessionNames(cwd: string): string[] {
  const root = requireAiRoot(cwd);
  const sessionsDir = path.join(root, ".ai", "sessions");
  if (!fs.existsSync(sessionsDir)) return [];
  return fs
    .readdirSync(sessionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
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

  const root = requireAiRoot(cwd);
  const current = readCurrent(root);
  log.info("セッション一覧 (.ai/sessions/):");
  for (const name of sessions) {
    const state = readStatus(root, name)?.endedAt ? "完了" : "進行中";
    const marker = name === current ? " *" : "";
    log.info(`  - ${name}（${state}）${marker}`);
  }
  if (current) log.info("\n  * = 現在のセッション");
}
