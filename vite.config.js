import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

// GH Pages 部署在 /aipm-playground/ 子路径；本地开发用根路径
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: mode === 'production' ? '/aipm-playground/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cosine: resolve(__dirname, 'cosine/index.html'),
        sampling: resolve(__dirname, 'sampling/index.html')
      }
    }
  }
}))
