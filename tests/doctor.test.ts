import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runDoctor, runDoctorFix } from "../src/doctor/runner";
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

/**
 * runDoctorFix(doctor --fix)のテスト。
 * fix を持つチェック(README / LICENSE / .gitignore / .env.example)は欠如時に
 * 最小構成を自動生成し、fix を持たないチェックは unfixable として手動対応に回す。
 * 既存ファイルは上書きせず、.foundruurc で無効化したチェックは対象外にする。
 */
describe("runDoctorFix", () => {
  it("欠けている scaffold ファイルを生成し、その後 doctor が pass する", () => {
    const { fixed, unfixable } = runDoctorFix(tmp);

    const fixedLabels = fixed.map((f) => f.label).sort();
    expect(fixedLabels).toEqual([".env.example", ".gitignore", "LICENSE", "README"]);
    // fix を持たない失敗項目は手動対応に回る
    expect(unfixable.map((u) => u.label)).toContain("Workflow");

    for (const rel of ["README.md", "LICENSE", ".gitignore", ".env.example"]) {
      expect(fs.existsSync(path.join(tmp, rel))).toBe(true);
    }
    // 生成済みの 4 項目は pass になる
    const report = runDoctor(tmp);
    for (const id of ["readme", "license", "gitignore", "env-example"]) {
      expect(report.results.find((r) => r.id === id)?.status).toBe("pass");
    }
  });

  it("README は package.json の name をタイトルに使う", () => {
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "my-pkg" }));
    runDoctorFix(tmp);
    expect(fs.readFileSync(path.join(tmp, "README.md"), "utf8")).toContain("# my-pkg");
  });

  it("既存ファイルは上書きしない(pass 項目は触らない)", () => {
    fs.writeFileSync(path.join(tmp, "README.md"), "ORIGINAL");
    const { fixed } = runDoctorFix(tmp);
    expect(fixed.map((f) => f.label)).not.toContain("README");
    expect(fs.readFileSync(path.join(tmp, "README.md"), "utf8")).toBe("ORIGINAL");
  });

  it(".foundruurc で無効化したチェックは修復しない", () => {
    fs.writeFileSync(
      path.join(tmp, ".foundruurc"),
      JSON.stringify({ doctor: { disable: ["readme"] } })
    );
    const { fixed } = runDoctorFix(tmp);
    expect(fixed.map((f) => f.label)).not.toContain("README");
    expect(fs.existsSync(path.join(tmp, "README.md"))).toBe(false);
  });
});

describe("session-requirements チェック", () => {
  const write = (rel: string, content: string) => {
    const full = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  const result = () => runDoctor(tmp).results.find((r) => r.id === "session-requirements");

  it("進行中セッションが無ければ pass", () => {
    expect(result()?.status).toBe("pass");
  });

  it("進行中セッションの requirements.md が空なら warn", () => {
    write(".ai/sessions/.current", "feature-x\n");
    write(".ai/sessions/feature-x/requirements.md", "  \n");
    expect(result()?.status).toBe("warn");
  });

  it("requirements.md が記入済みなら pass", () => {
    write(".ai/sessions/.current", "feature-x\n");
    write(".ai/sessions/feature-x/requirements.md", "# 要件\n- やること\n");
    expect(result()?.status).toBe("pass");
  });
});
