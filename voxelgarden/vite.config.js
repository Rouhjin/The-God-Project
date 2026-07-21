import { defineConfig } from 'vite';

// Relative base so the built site works whether it's served from a domain root
// or a project-pages subpath like https://<user>.github.io/<repo>/.
export default defineConfig({
  base: './',
  worker: {
    // inline the terrain/mesher worker as a classic worker so it resolves under
    // any base path without a separate module fetch
    format: 'iife',
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
