import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runDoctor } from "../src/doctor/runner";
import { checks } from "../src/doctor/checks";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-doctor-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("runDoctor", () => {
  it("空のリポジトリでは fail / warn になる", () => {
    const report = runDoctor(tmp);
    expect(report.ok).toBe(false);
    expect(report.results).toHaveLength(checks.length);
    expect(report.results.find((r) => r.id === "readme")?.status).toBe("fail");
    expect(report.results.find((r) => r.id === "license")?.status).toBe("warn");
  });

  it("必要ファイルが揃うと pass になる", () => {
    fs.writeFileSync(path.join(tmp, "README.md"), "# test");
    fs.writeFileSync(path.join(tmp, "LICENSE"), "MIT");
    fs.writeFileSync(path.join(tmp, ".gitignore"), "node_modules\n");
    fs.writeFileSync(path.join(tmp, ".env.example"), "");
    fs.writeFileSync(path.join(tmp, "package.json"), "{}");
    fs.writeFileSync(path.join(tmp, "Dockerfile"), "");
    fs.mkdirSync(path.join(tmp, ".github/workflows"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "CLAUDE.md"), "");
    fs.mkdirSync(path.join(tmp, ".ai/workflows"), { recursive: true });
    fs.mkdirSync(path.join(tmp, ".ai/prompts"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "foundruu.json"), "{}");

    const report = runDoctor(tmp);
    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.warned).toBe(0);
  });

  it("fail 項目には hint が付く", () => {
    const report = runDoctor(tmp);
    const workflow = report.results.find((r) => r.id === "workflow");
    expect(workflow?.hint).toContain("foundruu workflow install");
  });
});
