import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  // 全局忽略
  { ignores: ['dist', 'node_modules', 'refer', '*.config.*'] },

  // 基础规则
  js.configs.recommended,

  // TypeScript 规则
  ...tseslint.configs.recommended,

  // React Hooks 规则
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // React Refresh（HMR 兼容性检查）
  {
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: ['useLayoutContext', 'triggerLikeBurst'] }],
    },
  },

  // 项目自定义规则
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // 允许 _ 前缀的未使用变量（解构忽略常用模式）
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // 允许空接口继承（React 组件 props 常见模式）
      '@typescript-eslint/no-empty-object-type': 'off',
      // 允许 any 类型（渐进式类型收紧）
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // routes.tsx 不需要 react-refresh 检查（路由配置文件，非组件）
  {
    files: ['src/app/routes.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Prettier 集成（放在最后以覆盖格式规则）
  prettier,
);
