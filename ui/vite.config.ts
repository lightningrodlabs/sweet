import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import wasm from 'vite-plugin-wasm';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), wasm()],
    resolve: {
    dedupe: [
      '@holochain-open-dev/elements',
      '@holochain-open-dev/profiles',
      '@holochain-open-dev/stores',
      '@holochain-syn/core',
      'lit',
      '@lit/reactive-element',
    ],
  },
  optimizeDeps: {
    exclude: [
      "@holochain-open-dev/elements/dist/elements/display-error.js"
    ],
  },
  build: {
    minify: false,
    target: [
      'chrome89',
      'firefox89',
      'safari15',
      'edge89',
      'es2022'
    ]
  },
  server: {
    hmr: {
      host: 'localhost',
    },
    watch: {
      usePolling: true
    }
  },
});

