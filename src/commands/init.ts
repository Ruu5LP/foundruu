import fs from "fs";
import path from "path";
import { templatesRoot } from "../core/assets";
import { cliVersion, writeConfig, readConfig } from "../core/config";
import { copyTree, MergeConflict, TemplateContext } from "../core/copier";
import { log } from "../core/logger";
import {
  availableFeatures,
  DEFAULT_TEMPLATE,
  findTemplate,
  templates,
} from "../registry/templates";
import { installWorkflow } from "./workflow";

export interface InitOptions {
  template?: string;
  name?: string;
  description?: string;
  /** カンマ区切りの feature 指定(テンプレートのデフォルトを上書き) */
  features?: string;
  /** 対話プロンプトを出さずデフォルト値で進める */
  yes?: boolean;
}

/** --features のパースと検証。テンプレートデフォルトを上書きする */
export function resolveFeatures(spec: string | undefined, defaults: string[]): string[] {
  if (spec === undefined) return defaults;
  const requested = spec
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const unknown = requested.filter((f) => !(availableFeatures as readonly string[]).includes(f));
  if (unknown.length > 0) {
    throw new Error(
      `不明な feature です: ${unknown.join(", ")}(利用可能: ${availableFeatures.join(", ")})`
    );
  }
  return requested;
}

/** --template 未指定かつ TTY のとき、対話で不足オプションを埋める */
async function promptMissing(cwd: string, options: InitOptions): Promise<InitOptions> {
  const interactive = process.stdin.isTTY && !options.yes && !options.template;
  if (!interactive) return options;

  // @inquirer/prompts は ESM 専用。CommonJS ビルドで tsc が import() を require() へ
  // 変換しないよう、動的 import を明示的に保持する
  const importEsm = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<typeof import("@inquirer/prompts")>;
  const { select, input } = await importEsm("@inquirer/prompts");
  const template = await select({
    message: "テンプレートを選択してください",
    choices: templates.map((t) => ({
      name: `${t.label}${t.status === "planned" ? "（準備中）" : ""}`,
      value: t.id,
      disabled: t.status === "planned" ? "（準備中）" : false,
    })),
    default: DEFAULT_TEMPLATE,
  });
  const name =
    options.name ?? (await input({ message: "プロジェクト名", default: path.basename(cwd) }));
  const description =
    options.description ?? (await input({ message: "プロジェクトの説明（任意）" }));

  // feature をチェックボックスで選択(テンプレートのデフォルトが初期チェック)
  let features = options.features;
  if (features === undefined) {
    const { checkbox } = await importEsm("@inquirer/prompts");
    const defaults = findTemplate(template)?.features ?? [];
    const selected = await checkbox({
      message: "導入する feature を選択してください",
      choices: (availableFeatures as readonly string[]).map((f) => ({
        value: f,
        checked: defaults.includes(f),
      })),
    });
    features = selected.join(",");
  }
  return { ...options, template, name, description, features };
}

export async function runInit(cwd: string, rawOptions: InitOptions): Promise<void> {
  const options = await promptMissing(cwd, rawOptions);
  const templateId = options.template ?? DEFAULT_TEMPLATE;
  const template = findTemplate(templateId);

  if (!template) {
    const available = templates
      .map((t) => `${t.id}${t.status === "planned" ? " (準備中)" : ""}`)
      .join(", ");
    throw new Error(`テンプレート "${templateId}" は存在しません。利用可能: ${available}`);
  }
  if (template.status === "planned") {
    throw new Error(
      `テンプレート "${templateId}" は準備中です。現在利用可能なテンプレート: ` +
        templates
          .filter((t) => t.status === "available")
          .map((t) => t.id)
          .join(", ")
    );
  }

  const features = resolveFeatures(options.features, template.features);
  const ctx: TemplateContext = {
    projectName: options.name ?? path.basename(cwd),
    description: options.description ?? "",
    language: template.language,
    languageLabel: template.languageLabel,
    aiProviders: template.aiProviders,
    aiProviderLabels: template.aiProviders,
    features,
    featureLabels: features,
    year: new Date().getFullYear(),
  };

  const root = templatesRoot();
  let written = 0;
  const conflicts: MergeConflict[] = [];

  // 合成順: base → language → features → ai(共通 + プロバイダー別)
  const layers: string[] = [
    path.join(root, "base"),
    path.join(root, "languages", template.language),
    ...features.map((f) => path.join(root, "features", f)),
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
    conflicts.push(...result.conflicts);
  }

  // 既存プロジェクトへの後入れで値が食い違った箇所は、既存値を維持した上で差分を提示する
  if (conflicts.length > 0) {
    log.warn("既存の設定値を維持しました（テンプレートと異なる箇所）:");
    for (const c of conflicts) {
      log.warn(
        `  ${path.relative(cwd, c.file)} ${c.keyPath}: ${JSON.stringify(c.existing)}（テンプレート: ${JSON.stringify(c.incoming)}）`
      );
    }
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
