import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  resolve: {
    // The board does not use Matter Physics. Phaser ships this equivalent runtime without Matter.
    alias: { phaser: 'phaser/dist/phaser-arcade-physics.js' },
  },
  plugins: [
    react(),
    ...(mode === 'analyze' ? [visualizer({ filename: 'dist/bundle-analysis.html', gzipSize: true, brotliSize: true, open: false })] : []),
  ],
}));
