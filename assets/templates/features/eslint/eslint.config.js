// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * FoundRuu 標準 ESLint 設定。
 * 言語標準の `recommended` を下限とし、コーディング規約（.ai/company/coding-standard.md）を
 * 機械で担保するための厳格ルールを重ねている。リンターが緑でも規約違反は不可。
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      '.next/**',
      '.nuxt/**',
      '.output/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  // 基本型を厳密に扱う（型情報を使う厳格ルール一式）
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- 状態を極力持たない / 不変性を優先 ---
      'prefer-const': 'error',
      'no-var': 'error',
      'no-param-reassign': ['error', { props: true }],
      '@typescript-eslint/prefer-readonly': 'error',

      // --- AI にありがちな「無理やり型を合わせる」を禁止 ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true },
      ],

      // --- 型を明示する ---
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',

      // --- 非同期の安全性 ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // --- 未使用コードを残さない ---
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // --- ファイル肥大化・複雑度を抑える ---
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      complexity: ['warn', 12],

      // --- 命名プレフィクスを意味ごとに揃える ---
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          prefix: ['is', 'has', 'can', 'should', 'will', 'did', 'IS_', 'HAS_', 'CAN_', 'SHOULD_'],
        },
      ],
    },
  },
  {
    // 設定ファイル・素の JS は型チェック対象外
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
