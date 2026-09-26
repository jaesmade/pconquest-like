import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: resolve(root, 'dist-profile'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(root, 'scripts/profile/index.html') },
  },
});
