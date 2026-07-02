import fs from "fs";
import path from "path";

export const CONFIG_FILE = "foundruu.json";

export interface FoundruuConfig {
  version: string;
  template?: string;
  projectName?: string;
  installedAt?: string;
  workflow?: {
    version: string;
    installedAt: string;
  };
}

export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_FILE);
}

export function readConfig(cwd: string): FoundruuConfig | null {
  const file = configPath(cwd);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as FoundruuConfig;
}

export function writeConfig(cwd: string, config: FoundruuConfig): void {
  fs.writeFileSync(configPath(cwd), JSON.stringify(config, null, 2) + "\n");
}

export function cliVersion(): string {
  // dist/core/config.js からも src/core/config.ts からも ../../package.json
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8")
  ) as { version: string };
  return pkg.version;
}
