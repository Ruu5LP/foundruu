import fs from "fs";
import path from "path";
import { Command } from "commander";
import { DoctorCheck } from "../doctor/types";
import { readConfig } from "./config";
import { log } from "./logger";

/**
 * プラグインシステム。
 *
 * 読み込み対象:
 * 1. プロジェクトの node_modules にある `foundruu-plugin-*` / `@scope/foundruu-plugin-*`
 * 2. foundruu.json の `plugins` 配列(モジュール名 or 相対パス)
 *
 * プラグインは register(ctx) でコマンド追加・doctor チェック追加ができる:
 *
 *   module.exports = {
 *     name: "my-plugin",
 *     register({ program, addDoctorCheck }) {
 *       program.command("hello").action(() => console.log("hi"));
 *       addDoctorCheck({ id: "...", label: "...", category: "...",
 *                        severity: "warn", hint: "...", check: (ctx) => true });
 *     },
 *   };
 */

export interface PluginContext {
  program: Command;
  addDoctorCheck(check: DoctorCheck): void;
  log: typeof log;
}

export interface FoundruuPlugin {
  name: string;
  register(ctx: PluginContext): void;
}

export interface LoadedPlugin {
  name: string;
  source: string;
}

const PLUGIN_PREFIX = "foundruu-plugin-";

function discoverNodeModules(cwd: string): string[] {
  const nodeModulesDir = path.join(cwd, "node_modules");
  if (!fs.existsSync(nodeModulesDir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (entry.name.startsWith(PLUGIN_PREFIX)) {
      found.push(path.join(nodeModulesDir, entry.name));
    } else if (entry.name.startsWith("@") && entry.isDirectory()) {
      for (const scoped of fs.readdirSync(path.join(nodeModulesDir, entry.name))) {
        if (scoped.startsWith(PLUGIN_PREFIX)) {
          found.push(path.join(nodeModulesDir, entry.name, scoped));
        }
      }
    }
  }
  return found;
}

function configuredPlugins(cwd: string): string[] {
  const config = readConfig(cwd) as { plugins?: string[] } | null;
  return (config?.plugins ?? []).map((p) =>
    p.startsWith(".") || p.startsWith("/")
      ? path.resolve(cwd, p)
      : path.join(cwd, "node_modules", p)
  );
}

/**
 * プラグインを発見して register を呼ぶ。壊れたプラグインは警告してスキップする。
 */
export function loadPlugins(cwd: string, ctx: PluginContext): LoadedPlugin[] {
  const specs = [...new Set([...discoverNodeModules(cwd), ...configuredPlugins(cwd)])];
  const loaded: LoadedPlugin[] = [];

  for (const spec of specs) {
    try {
      // プラグインは名前/パスで実行時に動的ロードするため require を使う
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(spec) as FoundruuPlugin | { default: FoundruuPlugin };
      const plugin = ("default" in mod ? mod.default : mod) as FoundruuPlugin;
      if (!plugin?.name || typeof plugin.register !== "function") {
        log.warn(`プラグインの形式が不正です(name / register が必要): ${spec}`);
        continue;
      }
      plugin.register(ctx);
      loaded.push({ name: plugin.name, source: spec });
    } catch (err) {
      log.warn(`プラグインの読み込みに失敗しました: ${spec} (${(err as Error).message})`);
    }
  }
  return loaded;
}
