import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { log } from "../core/logger";

/**
 * git pre-commit フックの管理。
 * doctor の fail をコミット前に検知し、「事後の診断」を「その場のガードレール」にする。
 * 生成したフックにはマーカーを埋め込み、自分が生成したものだけを上書き・削除する。
 */

const HOOK_MARKER = "# FoundRuu pre-commit hook";

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER} — foundruu hooks install で生成 (削除: foundruu hooks uninstall)
# 緊急時のスキップ: git commit --no-verify

if [ -x "./node_modules/.bin/foundruu" ]; then
  FOUNDRUU="./node_modules/.bin/foundruu"
elif command -v foundruu >/dev/null 2>&1; then
  FOUNDRUU="foundruu"
elif [ -f "./dist/cli.js" ] && grep -q '"name": "foundruu"' package.json 2>/dev/null; then
  # foundruu 自身のリポジトリ(ドッグフーディング)
  FOUNDRUU="node ./dist/cli.js"
else
  echo "foundruu が見つからないため pre-commit チェックをスキップしました" >&2
  exit 0
fi

echo "FoundRuu pre-commit: foundruu doctor を実行します"
$FOUNDRUU doctor || {
  echo "" >&2
  echo "foundruu doctor が fail のためコミットを中止しました。fail 項目を解消してください。" >&2
  echo "(緊急時は git commit --no-verify でスキップできます)" >&2
  exit 1
}
`;

/** git のフックディレクトリを返す(core.hooksPath 設定にも追従する) */
function hooksDir(cwd: string): string {
  let rel: string;
  try {
    rel = execFileSync("git", ["-C", cwd, "rev-parse", "--git-path", "hooks"], { stdio: "pipe" })
      .toString()
      .trim();
  } catch {
    throw new Error("git リポジトリではありません。git init 後に実行してください。");
  }
  return path.isAbsolute(rel) ? rel : path.join(cwd, rel);
}

function hookFile(cwd: string): string {
  return path.join(hooksDir(cwd), "pre-commit");
}

function isOurs(file: string): boolean {
  return fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(HOOK_MARKER);
}

/** pre-commit フックを導入する。FoundRuu 以外の既存フックは force 指定時のみ上書き */
export function installHooks(cwd: string, options: { force?: boolean } = {}): void {
  const file = hookFile(cwd);
  if (fs.existsSync(file) && !isOurs(file) && !options.force) {
    throw new Error(
      `既存の pre-commit フックがあります: ${file}\n` +
        "  上書きする場合は --force を指定してください（既存フックの内容は失われます）。"
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, HOOK_SCRIPT, { mode: 0o755 });
  fs.chmodSync(file, 0o755);
  log.success("pre-commit フックを導入しました: コミット前に foundruu doctor が実行されます");
  log.info("  fail があるとコミットは中止されます（緊急時: git commit --no-verify）");
}

/** FoundRuu が生成した pre-commit フックを削除する(他者のフックには触れない) */
export function uninstallHooks(cwd: string): void {
  const file = hookFile(cwd);
  if (!fs.existsSync(file)) {
    log.info("pre-commit フックは導入されていません。");
    return;
  }
  if (!isOurs(file)) {
    throw new Error(`pre-commit フックは FoundRuu が生成したものではないため削除しません: ${file}`);
  }
  fs.rmSync(file);
  log.success("pre-commit フックを削除しました");
}

/** pre-commit フックの導入状態を表示する */
export function hooksStatus(cwd: string): void {
  const file = hookFile(cwd);
  if (isOurs(file)) {
    log.info("pre-commit フック: 導入済み（コミット前に foundruu doctor が実行されます）");
  } else if (fs.existsSync(file)) {
    log.info("pre-commit フック: FoundRuu 以外のフックが存在します");
    log.info("  導入する場合: foundruu hooks install --force（既存フックは上書きされます）");
  } else {
    log.info("pre-commit フック: 未導入");
    log.info("  導入する場合: foundruu hooks install");
  }
}
