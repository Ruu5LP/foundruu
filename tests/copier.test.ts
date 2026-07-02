import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copyTree, TemplateContext } from "../src/core/copier";

let src: string;
let dest: string;

const ctx: TemplateContext = {
  projectName: "my-app",
  description: "テスト",
  language: "typescript",
  languageLabel: "TypeScript",
  aiProviders: ["claude"],
  aiProviderLabels: ["Claude"],
  features: ["vitest"],
  featureLabels: ["Vitest"],
  year: 2026,
};

beforeEach(() => {
  src = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-src-"));
  dest = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-dest-"));
});
afterEach(() => {
  fs.rmSync(src, { recursive: true, force: true });
  fs.rmSync(dest, { recursive: true, force: true });
});

describe("copyTree", () => {
  it(".hbs をレンダリングして拡張子を外す", () => {
    fs.writeFileSync(path.join(src, "README.md.hbs"), "# {{projectName}}");
    copyTree(src, dest, ctx);
    expect(fs.readFileSync(path.join(dest, "README.md"), "utf8")).toBe("# my-app");
  });

  it("hasFeature / hasAi ヘルパーが使える", () => {
    fs.writeFileSync(
      path.join(src, "a.md.hbs"),
      "{{#if (hasFeature \"vitest\")}}V{{/if}}{{#if (hasAi \"claude\")}}C{{/if}}{{#if (hasAi \"codex\")}}X{{/if}}"
    );
    copyTree(src, dest, ctx);
    expect(fs.readFileSync(path.join(dest, "a.md"), "utf8")).toBe("VC");
  });

  it(".patch を既存 JSON にディープマージする", () => {
    fs.writeFileSync(path.join(dest, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
    fs.writeFileSync(path.join(src, "package.json.patch"), JSON.stringify({ scripts: { test: "vitest" } }));
    copyTree(src, dest, ctx);
    const merged = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(merged.scripts).toEqual({ build: "tsc", test: "vitest" });
  });

  it("既存ファイルはデフォルトでスキップし、overwrite で上書きする", () => {
    fs.writeFileSync(path.join(src, "x.txt"), "new");
    fs.writeFileSync(path.join(dest, "x.txt"), "old");
    const r1 = copyTree(src, dest, ctx);
    expect(r1.skipped).toHaveLength(1);
    expect(fs.readFileSync(path.join(dest, "x.txt"), "utf8")).toBe("old");

    const r2 = copyTree(src, dest, ctx, { overwrite: true });
    expect(r2.written).toHaveLength(1);
    expect(fs.readFileSync(path.join(dest, "x.txt"), "utf8")).toBe("new");
  });

  it("サブディレクトリを再帰的にコピーする", () => {
    fs.mkdirSync(path.join(src, "a/b"), { recursive: true });
    fs.writeFileSync(path.join(src, "a/b/c.txt"), "deep");
    copyTree(src, dest, ctx);
    expect(fs.readFileSync(path.join(dest, "a/b/c.txt"), "utf8")).toBe("deep");
  });
});
