import fs from "fs";
import path from "path";

/** FoundRuu の設定ファイル名(リポジトリルートに置く) */
export const CONFIG_FILE = "foundruu.json";

export interface FoundruuConfig {
  version: string;
  template?: string;
  projectName?: string;
  installedAt?: string;
  workflow?: {
    version: string;
    installedAt: string;
    /** 管理ファイルの相対パス → 導入時の sha256(update 時のユーザー編集検出に使用) */
    files?: Record<string, string>;
  };
}

/** foundruu.json の絶対パスを返す */
export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_FILE);
}

/** foundruu.json を読み込む。存在しなければ null */
export function readConfig(cwd: string): FoundruuConfig | null {
  const file = configPath(cwd);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as FoundruuConfig;
}

/** foundruu.json を整形して書き込む */
export function writeConfig(cwd: string, config: FoundruuConfig): void {
  fs.writeFileSync(configPath(cwd), JSON.stringify(config, null, 2) + "\n");
}

/** CLI 自身のバージョンを package.json から解決する */
export function cliVersion(): string {
  // 実行形態ごとに package.json の位置が変わるため候補を順に探す:
  //   - dist/core/config.js / src/core/config.ts … ../../package.json
  //   - GitHub Action 用バンドル(action/index.cjs) … ../package.json
  const candidates = [
    path.resolve(__dirname, "..", "..", "package.json"),
    path.resolve(__dirname, "..", "package.json"),
    path.resolve(__dirname, "package.json"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return (JSON.parse(fs.readFileSync(file, "utf8")) as { version: string }).version;
    }
  }
  return "0.0.0";
}
