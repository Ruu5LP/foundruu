import fs from "fs";
import path from "path";
import { templatesRoot } from "../core/assets";
import { cliVersion, writeConfig, readConfig } from "../core/config";
import { copyTree, TemplateContext } from "../core/copier";
import { log } from "../core/logger";
import { DEFAULT_TEMPLATE, findTemplate, templates } from "../registry/templates";
import { installWorkflow } from "./workflow";

export interface InitOptions {
  template?: string;
  name?: string;
  description?: string;
}

export function runInit(cwd: string, options: InitOptions): void {
  const templateId = options.template ?? DEFAULT_TEMPLATE;
  const template = findTemplate(templateId);

  if (!template) {
    const available = templates.map((t) => `${t.id}${t.status === "planned" ? " (準備中)" : ""}`).join(", ");
    throw new Error(`テンプレート "${templateId}" は存在しません。利用可能: ${available}`);
  }
  if (template.status === "planned") {
    throw new Error(
      `テンプレート "${templateId}" は準備中です。現在利用可能なテンプレート: ` +
        templates.filter((t) => t.status === "available").map((t) => t.id).join(", ")
    );
  }

  const ctx: TemplateContext = {
    projectName: options.name ?? path.basename(cwd),
    description: options.description ?? "",
    language: template.language,
    languageLabel: template.languageLabel,
    aiProviders: template.aiProviders,
    aiProviderLabels: template.aiProviders,
    features: template.features,
    featureLabels: template.features,
    year: new Date().getFullYear(),
  };

  const root = templatesRoot();
  let written = 0;

  // 合成順: base → language → features → ai(共通 + プロバイダー別)
  const layers: string[] = [
    path.join(root, "base"),
    path.join(root, "languages", template.language),
    ...template.features.map((f) => path.join(root, "features", f)),
    path.join(root, "ai", "_common"),
    ...template.aiProviders.map((p) => path.join(root, "ai", p)),
  ];

  for (const layer of layers) {
    if (!fs.existsSync(layer)) {
      log.warn(`テンプレートレイヤーが見つからないためスキップ: ${path.relative(root, layer)}`);
      continue;
    }
    // ai/_common は docs/ai 配下へ、それ以外はルートへ展開
    const dest = layer === path.join(root, "ai", "_common") ? path.join(cwd, "docs", "ai") : cwd;
    const result = copyTree(layer, dest, ctx);
    written += result.written.length;
  }

  // Workflow / Prompt / Rules / Doctor設定も一括導入
  installWorkflow(cwd, { overwrite: false });

  const config = readConfig(cwd) ?? { version: cliVersion() };
  config.version = cliVersion();
  config.template = template.id;
  config.projectName = ctx.projectName;
  config.installedAt = new Date().toISOString();
  writeConfig(cwd, config);

  log.success(`テンプレート "${template.id}" で初期化しました（${written}ファイル）`);
  log.info("");
  log.info("次のステップ:");
  log.info("  1. foundruu doctor でリポジトリの状態を確認");
  log.info("  2. .ai/prompts/session-workflow.md を AI エージェントに読ませて開発を開始");
}
