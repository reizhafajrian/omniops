import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Reserved GitOps Control Plane UI Port 9091 (avoids port 3000 conflicts with user React/Vite apps)
    port: 9091,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9090',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
});
