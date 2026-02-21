import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 生产环境不生成 source map（减小包体积）
    sourcemap: false,
    // 代码分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心 — 版本稳定，长期缓存
          'vendor-react': ['react', 'react-dom', 'react-router'],
          // 图表库 — 体积大，单独拆包
          'vendor-charts': ['recharts'],
          // 动画库 — 体积大，单独拆包
          'vendor-motion': ['motion'],
          // UI 工具库
          'vendor-ui': ['lucide-react', 'vaul', 'sonner', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // 静态资源内联阈值（小于 4KB 的资源内联为 base64）
    assetsInlineLimit: 4096,
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 600,
  },
  // 开发服务器配置
  server: {
    port: 5173,
    open: true,
  },
  // 预览服务器配置
  preview: {
    port: 4173,
  },
})
