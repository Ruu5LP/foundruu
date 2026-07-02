import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { syncTree, hashFile, FileHashes } from "../src/core/sync";

let src: string;
let dest: string;

const write = (dir: string, rel: string, content: string): string => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
};

beforeEach(() => {
  src = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-sync-src-"));
  dest = fs.mkdtempSync(path.join(os.tmpdir(), "foundruu-sync-dest-"));
});
afterEach(() => {
  fs.rmSync(src, { recursive: true, force: true });
  fs.rmSync(dest, { recursive: true, force: true });
});

describe("syncTree", () => {
  it("新規ファイルは add で書き込まれる", () => {
    write(src, ".ai/workflows/feature.md", "v2");
    const { plan } = syncTree(src, dest, {});
    expect(plan[0].status).toBe("add");
    expect(fs.readFileSync(path.join(dest, ".ai/workflows/feature.md"), "utf8")).toBe("v2");
  });

  it("未編集ファイルは update で上書きされる", () => {
    write(src, "a.md", "v2");
    const destFile = write(dest, "a.md", "v1");
    const recorded: FileHashes = { "a.md": hashFile(destFile) };
    const { plan } = syncTree(src, dest, recorded);
    expect(plan[0].status).toBe("update");
    expect(fs.readFileSync(destFile, "utf8")).toBe("v2");
  });

  it("ユーザー編集済みファイルは保護され、force で上書きされる", () => {
    write(src, "a.md", "v2");
    const destFile = write(dest, "a.md", "user-edited");
    const recorded: FileHashes = { "a.md": "different-hash" };

    const r1 = syncTree(src, dest, recorded);
    expect(r1.plan[0].status).toBe("user-modified");
    expect(fs.readFileSync(destFile, "utf8")).toBe("user-edited");
    // 保護したファイルは記録ハッシュを維持する
    expect(r1.hashes["a.md"]).toBe("different-hash");

    const r2 = syncTree(src, dest, recorded, { force: true });
    expect(fs.readFileSync(destFile, "utf8")).toBe("v2");
    expect(r2.hashes["a.md"]).toBe(hashFile(path.join(src, "a.md")));
  });

  it("記録が無い既存ファイルも user-modified として保護する", () => {
    write(src, "a.md", "v2");
    write(dest, "a.md", "unknown-origin");
    const { plan } = syncTree(src, dest, {});
    expect(plan[0].status).toBe("user-modified");
    expect(fs.readFileSync(path.join(dest, "a.md"), "utf8")).toBe("unknown-origin");
  });

  it("dryRun では計画だけ立てて書き込まない", () => {
    write(src, "a.md", "v2");
    const { plan } = syncTree(src, dest, {}, { dryRun: true });
    expect(plan[0].status).toBe("add");
    expect(fs.existsSync(path.join(dest, "a.md"))).toBe(false);
  });

  it("同一内容は unchanged", () => {
    write(src, "a.md", "same");
    write(dest, "a.md", "same");
    const { plan } = syncTree(src, dest, {});
    expect(plan[0].status).toBe("unchanged");
  });
});
