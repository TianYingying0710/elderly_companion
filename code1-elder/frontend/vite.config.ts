import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  // env 固定为 mock：本机 .env.local 可能打开 api 交叉联调模式（SOS / 课程 / 健康），
  // 测试不应随开发者本机环境漂移（需要 api 的用例自己 stubEnv）。
  test: {
    environment: 'jsdom',
    env: {
      VITE_SOS_DATA_MODE: 'mock',
      VITE_COURSE_DATA_MODE: 'mock',
      VITE_HEALTH_DATA_MODE: 'mock',
    },
  },
})
