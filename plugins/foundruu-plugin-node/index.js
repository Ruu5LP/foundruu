const fs = require("fs");
const path = require("path");

/**
 * FoundRuu 公式プラグイン(Node.js 開発衛生)。
 * doctor に Node プロジェクト向けの再現性・ハイジーンチェックを追加する。
 * foundruu-plugin-security と同じく、自作プラグインの参考実装でもある。
 */
module.exports = {
  name: "node",
  register({ addDoctorCheck }) {
    addDoctorCheck({
      id: "node-version-pinned",
      label: "Node バージョンの固定",
      category: "Node",
      severity: "warn",
      hint: ".nvmrc か package.json の engines.node で Node バージョンを固定してください",
      check: (ctx) => {
        if (ctx.existsAny([".nvmrc", ".node-version"])) return true;
        const pkgPath = path.join(ctx.cwd, "package.json");
        if (!fs.existsSync(pkgPath)) return false;
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          return Boolean(pkg.engines && pkg.engines.node);
        } catch {
          return false;
        }
      },
    });

    addDoctorCheck({
      id: "node-lockfile-committed",
      label: "ロックファイルのコミット",
      category: "Node",
      severity: "warn",
      hint: "再現性のため package-lock.json 等のロックファイルをコミットしてください",
      check: (ctx) =>
        ctx.existsAny([
          "package-lock.json",
          "npm-shrinkwrap.json",
          "yarn.lock",
          "pnpm-lock.yaml",
          "bun.lockb",
        ]),
    });

    addDoctorCheck({
      id: "node-modules-ignored",
      label: "node_modules が gitignore されている",
      category: "Node",
      severity: "error",
      hint: ".gitignore に node_modules を追加し、依存のコミットを防いでください",
      check: (ctx) => {
        const gitignore = path.join(ctx.cwd, ".gitignore");
        if (!fs.existsSync(gitignore)) return false;
        return fs
          .readFileSync(gitignore, "utf8")
          .split(/\r?\n/)
          .some((line) => /^\/?node_modules\/?$/.test(line.trim()));
      },
    });
  },
};
