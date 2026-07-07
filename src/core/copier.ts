import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export interface TemplateContext {
  projectName: string;
  description: string;
  language: string;
  languageLabel: string;
  aiProviders: string[];
  aiProviderLabels: string[];
  features: string[];
  featureLabels: string[];
  year: number;
}

/** JSON マージ時に既存値とテンプレート値が食い違った箇所（既存値を維持した上で報告する） */
export interface MergeConflict {
  /** マージ先ファイルの絶対パス */
  file: string;
  /** 衝突したキーのパス（例: "engines.node"） */
  keyPath: string;
  existing: unknown;
  incoming: unknown;
}

export interface CopyResult {
  written: string[];
  skipped: string[];
  conflicts: MergeConflict[];
}

function createHandlebars(ctx: TemplateContext): typeof Handlebars {
  const hbs = Handlebars.create();
  hbs.registerHelper("hasFeature", (id: string) => ctx.features.includes(id));
  hbs.registerHelper("hasAi", (id: string) => ctx.aiProviders.includes(id));
  hbs.registerHelper(
    "eq",
    function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
      if (options && typeof options.fn === "function") {
        return a === b ? options.fn(this) : options.inverse(this);
      }
      return a === b;
    }
  );
  return hbs as typeof Handlebars;
}

/**
 * 既存(target)へパッチ(source)をディープマージする。
 * 既存プロジェクトへの後入れで設定を壊さないよう、値が食い違うキーは既存値を維持し、
 * conflicts に記録して呼び出し側が報告できるようにする。
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  conflicts: Omit<MergeConflict, "file">[],
  prefix = ""
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    const existing = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
        conflicts,
        keyPath
      );
    } else if (Array.isArray(value) && Array.isArray(existing)) {
      out[key] = [...new Set([...existing, ...value])];
    } else if (!(key in out) || existing === undefined) {
      out[key] = value;
    } else if (JSON.stringify(existing) !== JSON.stringify(value)) {
      // 既存値を優先し、テンプレートとの食い違いとして記録する
      conflicts.push({ keyPath, existing, incoming: value });
    }
  }
  return out;
}

/**
 * srcDir 以下を destDir へ再帰コピーする。
 * - `*.hbs`         : Handlebars でレンダリングし拡張子を外して書き出す
 * - `*.patch`       : 同名ファイル(拡張子を外した先)へ JSON ディープマージ
 * - それ以外        : そのままコピー
 * - 既存ファイルは overwrite=false ならスキップ
 */
export function copyTree(
  srcDir: string,
  destDir: string,
  ctx: TemplateContext,
  options: { overwrite?: boolean } = {}
): CopyResult {
  const overwrite = options.overwrite ?? false;
  const hbs = createHandlebars(ctx);
  const result: CopyResult = { written: [], skipped: [], conflicts: [] };

  const walk = (src: string, dest: string): void => {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      if (entry.isDirectory()) {
        walk(srcPath, path.join(dest, entry.name));
        continue;
      }

      if (entry.name.endsWith(".patch")) {
        const destPath = path.join(dest, entry.name.replace(/\.patch$/, ""));
        // patch 内にも {{projectName}} 等のテンプレート変数を書けるようレンダリングしてから解釈する
        const rendered = hbs.compile(fs.readFileSync(srcPath, "utf8"))(ctx);
        fs.mkdirSync(dest, { recursive: true });
        if (destPath.endsWith(".json")) {
          // JSON はディープマージ
          const patch = JSON.parse(rendered) as Record<string, unknown>;
          const base = fs.existsSync(destPath)
            ? (JSON.parse(fs.readFileSync(destPath, "utf8")) as Record<string, unknown>)
            : {};
          const conflicts: Omit<MergeConflict, "file">[] = [];
          const merged = deepMerge(base, patch, conflicts);
          fs.writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n");
          result.conflicts.push(...conflicts.map((c) => ({ ...c, file: destPath })));
        } else {
          // テキスト(.env.example 等)は末尾へ追記（既に含まれていればスキップ）
          const base = fs.existsSync(destPath) ? fs.readFileSync(destPath, "utf8") : "";
          if (base.includes(rendered.trim())) {
            result.skipped.push(destPath);
            continue;
          }
          const sep = base.length && !base.endsWith("\n") ? "\n" : "";
          fs.writeFileSync(destPath, base + sep + rendered.trimEnd() + "\n");
        }
        result.written.push(destPath);
        continue;
      }

      const isHbs = entry.name.endsWith(".hbs");
      const destPath = path.join(dest, isHbs ? entry.name.replace(/\.hbs$/, "") : entry.name);

      if (fs.existsSync(destPath) && !overwrite) {
        result.skipped.push(destPath);
        continue;
      }

      fs.mkdirSync(dest, { recursive: true });
      if (isHbs) {
        const rendered = hbs.compile(fs.readFileSync(srcPath, "utf8"))(ctx);
        fs.writeFileSync(destPath, rendered);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      result.written.push(destPath);
    }
  };

  walk(srcDir, destDir);
  return result;
}
