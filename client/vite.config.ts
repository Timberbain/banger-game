import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 8080,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        editor: path.resolve(__dirname, 'editor/index.html'),
        tileViewer: path.resolve(__dirname, 'tile-viewer/index.html'),
      },
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  define: {
    'process.env': {},
  },
});
