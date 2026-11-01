import { defineConfig } from 'vitest/config'

/**
 * 纯 TypeScript 单元测试配置。
 *
 * 刻意不加载 `@dcloudio/vite-plugin-uni` 或任何 Vue 插件：
 * 这些 spec 只测 mapper / domain / API / composable，不需要 uni 运行时；
 * 加载它们会连带要求本机未安装的 `@babel/core`，导致测试入口不可用。
 *
 * 生产构建仍由 `vite.config.ts` 负责，本文件不得被其导入。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
