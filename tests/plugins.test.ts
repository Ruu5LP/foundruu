import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Command } from "commander";
import { loadPlugins, PluginContext } from "../src/core/plugins";
import { DoctorCheck } from "../src/doctor/types";
import { log } from "../src/core/logger";

let tmp: string;
let addedChecks: DoctorCheck[];
let ctx: PluginContext;

const writePlugin = (dir: string, body: string) => {
  const full = path.join(tmp, "node_modules", dir);
  fs.mkdirSync(full, { recursive: true });
  fs.writeFileSync(path.join(full, "package.json"), JSON.stringify({ name: dir, main: "index.js" }));
  fs.writeFileSync(path.join(full, "index.js"), body);
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-plugin-test-"));
  addedChecks = [];
  ctx = {
    program: new Command(),
    addDoctorCheck: (c) => addedChecks.push(c),
    log,
  };
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("loadPlugins", () => {
  it("node_modules の foundruu-plugin-* を発見して register を呼ぶ", () => {
    writePlugin(
      "foundruu-plugin-hello",
      `module.exports = { name: "hello", register(ctx) {
        ctx.program.command("hello");
        ctx.addDoctorCheck({ id: "x", label: "X", category: "c", severity: "warn", hint: "h", check: () => true });
      } };`
    );
    const loaded = loadPlugins(tmp, ctx);
    expect(loaded.map((p) => p.name)).toEqual(["hello"]);
    expect(ctx.program.commands.map((c) => c.name())).toContain("hello");
    expect(addedChecks).toHaveLength(1);
  });

  it("スコープ付きパッケージも発見する", () => {
    writePlugin(
      path.join("@ruu", "foundruu-plugin-scoped"),
      `module.exports = { name: "scoped", register() {} };`
    );
    expect(loadPlugins(tmp, ctx).map((p) => p.name)).toEqual(["scoped"]);
  });

  it("foundruu.json の plugins(相対パス)を読み込む", () => {
    fs.mkdirSync(path.join(tmp, "my-plugin"));
    fs.writeFileSync(
      path.join(tmp, "my-plugin", "index.js"),
      `module.exports = { name: "local", register() {} };`
    );
    fs.writeFileSync(
      path.join(tmp, "foundruu.json"),
      JSON.stringify({ version: "0.1.0", plugins: ["./my-plugin"] })
    );
    expect(loadPlugins(tmp, ctx).map((p) => p.name)).toEqual(["local"]);
  });

  it("壊れたプラグインはスキップして他を読み込む", () => {
    writePlugin("foundruu-plugin-broken", `throw new Error("boom");`);
    writePlugin("foundruu-plugin-ok", `module.exports = { name: "ok", register() {} };`);
    const loaded = loadPlugins(tmp, ctx);
    expect(loaded.map((p) => p.name)).toEqual(["ok"]);
  });

  it("形式不正(register 無し)は読み込まない", () => {
    writePlugin("foundruu-plugin-bad", `module.exports = { name: "bad" };`);
    expect(loadPlugins(tmp, ctx)).toHaveLength(0);
  });
});
