import fs from "fs";
import path from "path";
import { workflowRoot } from "../core/assets";
import { cliVersion, readConfig, writeConfig } from "../core/config";
import { copyTree, TemplateContext } from "../core/copier";
import { log } from "../core/logger";

const GITIGNORE_ENTRY = ".ai/sessions/";

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

function ensureGitignoreEntry(cwd: string): void {
  const file = path.join(cwd, ".gitignore");
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (current.split(/\r?\n/).includes(GITIGNORE_ENTRY)) return;
  const next = current.length && !current.endsWith("\n") ? current + "\n" : current;
  fs.writeFileSync(file, `${next}${GITIGNORE_ENTRY}\n`);
  log.step(`.gitignore に ${GITIGNORE_ENTRY} を追加しました`);
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

  for (const file of result.written) {
    log.step(`書き込み: ${path.relative(cwd, file)}`);
  }
  if (result.skipped.length > 0) {
    log.info(`  既存のためスキップ: ${result.skipped.length}件（上書きは foundruu update --force）`);
  }

  const config = readConfig(cwd) ?? { version: cliVersion() };
  config.workflow = { version: cliVersion(), installedAt: new Date().toISOString() };
  writeConfig(cwd, config);
  log.success(`Workflow を導入しました（${result.written.length}ファイル）`);
}
