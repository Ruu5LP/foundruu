import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // 計測対象はロジックを持つ src のみ。エントリ配線や型定義は除外する。
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli.ts", // commander の配線のみ(挙動は各 command のテストで担保)
        "src/doctor/types.ts", // 型定義のみ
        "src/**/index.ts",
      ],
      // 回帰防止の下限。現状値より少し低く設定し、カバレッジが下がる変更で CI を落とす。
      // 上げたくなったら実測値に合わせて引き上げる。
      thresholds: {
        statements: 74,
        branches: 63,
        functions: 75,
        lines: 73,
      },
    },
  },
});
