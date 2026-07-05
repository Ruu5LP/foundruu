/**
 * init コマンドの resolveFeatures のテスト。
 *
 * resolveFeatures は `--features docker,vitest` のようなユーザー入力を
 * パース・検証する純関数で、init の入口。ここで不正な feature を弾けないと
 * 後段のテンプレート展開で不明なフラグが素通りしてしまう。そのため:
 *   - 未指定(undefined)はテンプレートのデフォルトをそのまま使う
 *   - カンマ区切りをパースし、前後の空白を落とす
 *   - 空文字は空配列(=feature なし)
 *   - 未知の feature はエラーにして利用可能一覧を提示する
 */
import { describe, it, expect } from "vitest";
import { resolveFeatures } from "../src/commands/init";

describe("resolveFeatures", () => {
  it("未指定のときはテンプレートのデフォルトをそのまま返す", () => {
    const defaults = ["docker", "vitest"];
    expect(resolveFeatures(undefined, defaults)).toBe(defaults);
  });

  it("カンマ区切りをパースし前後の空白を落とす", () => {
    expect(resolveFeatures(" docker , vitest ", [])).toEqual(["docker", "vitest"]);
  });

  it("空文字は空配列(feature なし)になる", () => {
    expect(resolveFeatures("", ["docker"])).toEqual([]);
  });

  it("未知の feature はエラーにし、利用可能一覧を示す", () => {
    expect(() => resolveFeatures("docker,bogus", [])).toThrowError(/bogus/);
    expect(() => resolveFeatures("bogus", [])).toThrowError(/利用可能/);
  });

  it("既知の feature のみなら検証を通過する", () => {
    expect(resolveFeatures("eslint,prettier", ["docker"])).toEqual(["eslint", "prettier"]);
  });
});
