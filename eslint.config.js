// ESLint v9 flat config — lorekit
// 规则锚定 docs/CONVENTIONS.md 的 Do Not 红线（#2/#3/#4）。
// 老代码违规很多，本配置只锁新代码方向；批量清整由 REFACTOR-PLAN 批次 11-14 处理。
//
// 重要：lint 不进 verify chain（CONVENTIONS #11 + REFACTOR-PLAN 批次 3 硬约束）。
// 重构期间 `npm run lint` 由人 / AI 手动跑，不自动阻断。

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // ---- 全局忽略 ----
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'plugins/obsidian-audit/main.js', // 第三方构建产物
      '**/*.tar.gz',
    ],
  },

  // ---- Node 全局变量（process / Buffer / __dirname 等） ----
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ---- 基础规则 ----
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- CONVENTIONS Do Not 强制 ----
  {
    rules: {
      // Do Not #2：直接 console.* 禁止；统一走 utils/logger.ts
      'no-console': 'error',

      // Do Not #4：裸 as any 禁止
      '@typescript-eslint/no-explicit-any': 'error',

      // Do Not #3：沉默 catch 禁止
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Do Not #4：@ts-ignore 禁，@ts-expect-error 必须带原因注释
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 5,
        },
      ],

      // 未用变量：允许 _ 前缀（用于"占位"参数）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ---- 例外 1：utils/logger.ts 是输出唯一通道，console.* 在这里合法 ----
  {
    files: ['src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // ---- 例外 2：tests/ 是 .mjs，typescript-eslint 规则不应用；node:test 自身的 .skip 等 API 偶尔需要灵活性 ----
  {
    files: ['tests/**/*.{js,mjs}'],
    rules: {
      'no-console': 'off', // smoke 失败诊断输出
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ---- prettier 关闭所有跟格式冲突的规则（必须放最后） ----
  prettier,
);
