import fs from "fs";
import path from "path";
import { workflowRoot } from "../core/assets";
import { cliVersion, readConfig, writeConfig } from "../core/config";
import { copyTree, TemplateContext } from "../core/copier";
import { log } from "../core/logger";
import { FileHashes, hashFile, listFiles } from "../core/sync";

const GITIGNORE_ENTRY = ".ai/sessions/";
const PRETTIER_IGNORE_ENTRY = ".ai";

function neutralContext(cwd: string): TemplateContext {
  return {
    projectName: path.basename(cwd),
    description: "",
    language: "",
    languageLabel: "",
    aiProviders: [],
    aiProviderLabels: [],
    features: [],
    featureLabels: [],
    year: new Date().getFullYear(),
  };
}

/** ignore ファイルに 1 行を冪等に追加する（無ければ作成）。追加したら true。 */
function appendIgnoreLine(file: string, entry: string): boolean {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (current.split(/\r?\n/).includes(entry)) return false;
  const next = current.length && !current.endsWith("\n") ? current + "\n" : current;
  fs.writeFileSync(file, `${next}${entry}\n`);
  return true;
}

function ensureGitignoreEntry(cwd: string): void {
  if (appendIgnoreLine(path.join(cwd, ".gitignore"), GITIGNORE_ENTRY)) {
    log.step(`.gitignore に ${GITIGNORE_ENTRY} を追加しました`);
  }
}

/** Prettier を使っているか（設定ファイルか package.json の prettier キーで判定）。 */
function usesPrettier(cwd: string): boolean {
  const configFiles = [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.json5",
    ".prettierrc.yaml",
    ".prettierrc.yml",
    ".prettierrc.toml",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
    ".prettierignore",
  ];
  if (configFiles.some((f) => fs.existsSync(path.join(cwd, f)))) return true;
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.prettier !== undefined) return true;
    } catch {
      // package.json が壊れていても導入自体は続行する
    }
  }
  return false;
}

/**
 * Prettier 使用時、管理対象の .ai/ を整形対象外にする。
 * ローカルで整形されるとハッシュが変わり、foundruu update がユーザー編集と誤検知するため。
 */
function ensurePrettierIgnoreEntry(cwd: string): void {
  if (!usesPrettier(cwd)) return;
  if (appendIgnoreLine(path.join(cwd, ".prettierignore"), PRETTIER_IGNORE_ENTRY)) {
    log.step(`.prettierignore に ${PRETTIER_IGNORE_ENTRY} を追加しました`);
  }
}

/**
 * Workflow / Prompt / Rules(.ai/) を導入する。
 * @param overwrite true の場合、既存ファイルも最新アセットで上書きする(update用)
 */
export function installWorkflow(cwd: string, options: { overwrite?: boolean } = {}): void {
  const result = copyTree(workflowRoot(), cwd, neutralContext(cwd), {
    overwrite: options.overwrite ?? false,
  });
  ensureGitignoreEntry(cwd);
  ensurePrettierIgnoreEntry(cwd);

  for (const file of result.written) {
    log.step(`書き込み: ${path.relative(cwd, file)}`);
  }
  if (result.skipped.length > 0) {
    log.info(
      `  既存のためスキップ: ${result.skipped.length}件（上書きは foundruu update --force）`
    );
  }

  // 管理ファイルの導入時ハッシュを記録する(update 時のユーザー編集検出に使用)
  const files: FileHashes = {};
  for (const relPath of listFiles(workflowRoot())) {
    const destPath = path.join(cwd, relPath);
    if (fs.existsSync(destPath)) files[relPath] = hashFile(destPath);
  }

  const config = readConfig(cwd) ?? { version: cliVersion() };
  config.workflow = { version: cliVersion(), installedAt: new Date().toISOString(), files };
  writeConfig(cwd, config);
  log.success(`Workflow を導入しました（${result.written.length}ファイル）`);
}
