import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 仅用于构建校验与体积报告，线上仍发布仓库根目录
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: resolve(process.cwd(), 'src/main.js'),
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
