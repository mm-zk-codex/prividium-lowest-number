import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,        // 🔥 disable minification
    sourcemap: true       // 🔥 generate readable source maps
  }
});
