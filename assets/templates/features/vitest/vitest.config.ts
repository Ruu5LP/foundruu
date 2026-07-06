import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // テスト方針（.ai/project/testing.md）の「新規コード 80% 以上」を機械で担保する。
      // 下回ると test:coverage が失敗する。
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
