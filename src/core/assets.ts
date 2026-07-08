import path from "path";
import fs from "fs";

/**
 * 同梱アセット(assets/)のルートを解決する。
 * ビルド後は dist/core/assets.js から見て ../../assets、
 * ts-node 実行時は src/core/assets.ts から見ても同じ相対位置になる。
 */
export function assetsRoot(): string {
  const root = path.resolve(__dirname, "..", "..", "assets");
  if (!fs.existsSync(root)) {
    throw new Error(`同梱アセットが見つかりません: ${root}`);
  }
  return root;
}

/** 同梱テンプレート(assets/templates)のルートを返す */
export function templatesRoot(): string {
  return path.join(assetsRoot(), "templates");
}

/** 同梱ワークフローアセット(assets/workflow)のルートを返す */
export function workflowRoot(): string {
  return path.join(assetsRoot(), "workflow");
}
