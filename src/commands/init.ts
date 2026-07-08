import fs from "fs";
import path from "path";
import { templatesRoot } from "../core/assets";
import { cliVersion, writeConfig, readConfig } from "../core/config";
import { copyTree, TemplateContext } from "../core/copier";
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

/** init 開始前から存在していた値を維持した箇所（既存値 / テンプレート値の差分報告用） */
interface PreservedValue {
  /** 対象ファイルの絶対パス */
  file: string;
  /** キーのパス（例: "engines.node"） */
  keyPath: string;
  existing: unknown;
  incoming: unknown;
}

/** layer 以下の `*.json.patch` が書き込む先(destDir 基準)の絶対パスを列挙する */
function collectJsonPatchTargets(layerDir: string, destDir: string): string[] {
  const targets: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(layerDir, rel), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(rel, entry.name));
      } else if (entry.name.endsWith(".json.patch")) {
        targets.push(path.join(destDir, rel, entry.name.replace(/\.patch$/, "")));
      }
    }
  };
  walk("");
  return targets;
}

/**
 * テンプレート展開後の JSON(current)へ、init 開始前のスナップショット(original)の値を
 * 復元する。既存プロジェクトへの後入れでユーザーの設定が黙って書き換わるのを防ぐため、
 * original に存在していたキーはテンプレート値より優先し、食い違った箇所を preserved に
 * 記録する。original に無いキー(テンプレートが追加したもの)と、配列のユニオン結果は
 * そのまま維持する。
 */
function restoreOriginalValues(
  current: Record<string, unknown>,
  original: Record<string, unknown>,
  preserved: PreservedValue[],
  file: string,
  prefix = ""
): void {
  for (const [key, originalValue] of Object.entries(original)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    const currentValue = current[key];
    if (
      originalValue &&
      typeof originalValue === "object" &&
      !Array.isArray(originalValue) &&
      currentValue &&
      typeof currentValue === "object" &&
      !Array.isArray(currentValue)
    ) {
      restoreOriginalValues(
        currentValue as Record<string, unknown>,
        originalValue as Record<string, unknown>,
        preserved,
        file,
        keyPath
      );
    } else if (Array.isArray(originalValue) && Array.isArray(currentValue)) {
      // 配列はユニオン済み(既存要素は残っている)ため復元不要
    } else if (JSON.stringify(currentValue) !== JSON.stringify(originalValue)) {
      preserved.push({ file, keyPath, existing: originalValue, incoming: currentValue });
      current[key] = originalValue;
    }
  }
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

/** init コマンド本体。テンプレート + Workflow + Doctor 設定を一括導入する */
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

  // 合成順: base → language → features → ai(共通 + プロバイダー別)
  const layers: string[] = [
    path.join(root, "base"),
    path.join(root, "languages", template.language),
    ...features.map((f) => path.join(root, "features", f)),
    path.join(root, "ai", "_common"),
    ...template.aiProviders.map((p) => path.join(root, "ai", p)),
  ];

  // ai/_common は docs/ai 配下へ、それ以外はルートへ展開
  const layerDest = (layer: string): string =>
    layer === path.join(root, "ai", "_common") ? path.join(cwd, "docs", "ai") : cwd;

  // JSON パッチの適用先のうち init 開始前から存在するものをスナップショットする。
  // レイヤー間の上書き(後勝ち)は意図した合成なので許容し、ユーザーの既存値だけを守る
  const originals = new Map<string, Record<string, unknown>>();
  for (const layer of layers.filter((l) => fs.existsSync(l))) {
    for (const target of collectJsonPatchTargets(layer, layerDest(layer))) {
      if (!originals.has(target) && fs.existsSync(target)) {
        originals.set(
          target,
          JSON.parse(fs.readFileSync(target, "utf8")) as Record<string, unknown>
        );
      }
    }
  }

  for (const layer of layers) {
    if (!fs.existsSync(layer)) {
      log.warn(`テンプレートレイヤーが見つからないためスキップ: ${path.relative(root, layer)}`);
      continue;
    }
    const result = copyTree(layer, layerDest(layer), ctx);
    written += result.written.length;
  }

  // 既存プロジェクトへの後入れでテンプレートと値が食い違った箇所は、既存値へ戻して差分を提示する
  const preserved: PreservedValue[] = [];
  for (const [file, original] of originals) {
    const current = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    restoreOriginalValues(current, original, preserved, file);
    fs.writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
  }
  if (preserved.length > 0) {
    log.warn("既存の設定値を維持しました（テンプレートと異なる箇所）:");
    for (const p of preserved) {
      log.warn(
        `  ${path.relative(cwd, p.file)} ${p.keyPath}: ${JSON.stringify(p.existing)}（テンプレート: ${JSON.stringify(p.incoming)}）`
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
