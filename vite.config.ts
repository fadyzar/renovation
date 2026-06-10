import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A unique id for this build. Compiled into the bundle (__BUILD_ID__) AND
// written to /version.json, so the running app can tell whether a newer
// version has been deployed — and only then prompt for a refresh.
const buildId = String(Date.now());

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId }),
        });
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
