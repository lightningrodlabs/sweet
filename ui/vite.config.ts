import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import wasm from 'vite-plugin-wasm';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), wasm()],
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

