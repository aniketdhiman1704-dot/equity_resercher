import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Preserve the browser-facing host so the API can enforce same-origin POSTs.
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'charts', test: /node_modules\/(recharts|d3-[^/]+|victory-vendor)\// }],
        },
      },
    },
  },
});
