import { defineConfig } from 'vite';

export default defineConfig({
  // 별도 도메인의 하위 경로에 올린다면 base 를 그 경로로 바꿔 주세요.
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096
  },
  server: {
    host: true,
    port: 5173
  }
});
