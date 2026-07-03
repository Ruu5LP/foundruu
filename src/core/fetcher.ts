import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { workflowRoot } from "./assets";
import { log } from "./logger";

const ASSETS_REPO = "https://github.com/Ruu5LP/foundruu.git";

function cacheDir(): string {
  return path.join(os.homedir(), ".foundruu", "cache", "foundruu");
}

/**
 * GitHub 上の最新アセット(assets/workflow)を取得し、そのパスを返す。
 * 取得できない場合(オフライン等)は CLI 同梱アセットへフォールバックする。
 */
export function fetchWorkflowAssets(options: { local?: boolean } = {}): {
  root: string;
  source: "remote" | "bundled";
} {
  if (options.local) {
    return { root: workflowRoot(), source: "bundled" };
  }

  const cache = cacheDir();
  try {
    if (fs.existsSync(path.join(cache, ".git"))) {
      execFileSync("git", ["-C", cache, "fetch", "--depth", "1", "origin", "main"], {
        stdio: "pipe",
        timeout: 30_000,
      });
      execFileSync("git", ["-C", cache, "reset", "--hard", "origin/main"], {
        stdio: "pipe",
        timeout: 30_000,
      });
    } else {
      fs.rmSync(cache, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      execFileSync("git", ["clone", "--depth", "1", ASSETS_REPO, cache], {
        stdio: "pipe",
        timeout: 60_000,
      });
    }
    const remoteWorkflow = path.join(cache, "assets", "workflow");
    if (fs.existsSync(remoteWorkflow)) {
      return { root: remoteWorkflow, source: "remote" };
    }
    log.warn("リモートリポジトリに assets/workflow が見つかりません。同梱アセットを使用します。");
  } catch {
    log.warn("GitHub から最新アセットを取得できませんでした(オフライン?)。同梱アセットを使用します。");
  }
  return { root: workflowRoot(), source: "bundled" };
}
