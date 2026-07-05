/**
 * 公式プラグイン foundruu-plugin-node のテスト。
 *
 * プラグインは doctor に Node 衛生チェックを 3 件足す。ここではプラグインを
 * 直接読み込んで register でチェックを回収し、各チェックの check(ctx) を
 * 一時ディレクトリの状況(ファイルの有無)に対して検証する。プラグインが
 * 参考実装として正しく動くことを保証する意味もある。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DoctorCheck, DoctorContext } from "../src/doctor/types";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../plugins/foundruu-plugin-node/index.js");

let cwd: string;
let checks: Record<string, DoctorCheck>;

/** 実際の doctor と同じ DoctorContext を組み立てる */
const contextFor = (base: string): DoctorContext => {
  const exists = (rel: string) => fs.existsSync(path.join(base, rel));
  return { cwd: base, exists, existsAny: (rels) => rels.some(exists) };
};

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-plugin-node-"));
  checks = {};
  plugin.register({ addDoctorCheck: (c: DoctorCheck) => (checks[c.id] = c) });
});
afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

const run = (id: string) => checks[id].check(contextFor(cwd));

describe("foundruu-plugin-node", () => {
  it("3 件のチェックを登録する", () => {
    expect(Object.keys(checks).sort()).toEqual([
      "node-lockfile-committed",
      "node-modules-ignored",
      "node-version-pinned",
    ]);
  });

  describe("node-version-pinned", () => {
    it(".nvmrc があれば pass", () => {
      fs.writeFileSync(path.join(cwd, ".nvmrc"), "22\n");
      expect(run("node-version-pinned")).toBe(true);
    });

    it("engines.node があれば pass", () => {
      fs.writeFileSync(
        path.join(cwd, "package.json"),
        JSON.stringify({ engines: { node: ">=22" } })
      );
      expect(run("node-version-pinned")).toBe(true);
    });

    it("どちらも無ければ fail", () => {
      fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ name: "x" }));
      expect(run("node-version-pinned")).toBe(false);
    });
  });

  describe("node-lockfile-committed", () => {
    it("package-lock.json があれば pass", () => {
      fs.writeFileSync(path.join(cwd, "package-lock.json"), "{}");
      expect(run("node-lockfile-committed")).toBe(true);
    });

    it("ロックファイルが無ければ fail", () => {
      expect(run("node-lockfile-committed")).toBe(false);
    });
  });

  describe("node-modules-ignored", () => {
    it(".gitignore に node_modules があれば pass", () => {
      fs.writeFileSync(path.join(cwd, ".gitignore"), "node_modules/\ndist/\n");
      expect(run("node-modules-ignored")).toBe(true);
    });

    it(".gitignore に無ければ fail", () => {
      fs.writeFileSync(path.join(cwd, ".gitignore"), "dist/\n");
      expect(run("node-modules-ignored")).toBe(false);
    });
  });
});
