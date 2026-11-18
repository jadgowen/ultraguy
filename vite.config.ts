import { defineConfig } from 'vite';

// base './' so the build works from any static host path (GitHub Pages, itch.io).
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB
    // Phaser in its own file: it rarely changes, so browsers keep it cached across updates.
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) } },
  },
});
