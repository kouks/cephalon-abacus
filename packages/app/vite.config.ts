import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Resolves `@/…` from the importing file's own package, so the app can consume package sources.
  resolve: { tsconfigPaths: true },
});
