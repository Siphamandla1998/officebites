import config from '../vite.config.js';

// The real production PWA build is checked separately. This test-only build
// adds the synthetic provider harness and keeps generated output out of Git.
export default {
  ...config,
  plugins: [config.plugins[0]],
  cacheDir: 'node_modules/.vite-browser-checks',
  build: {
    outDir: 'node_modules/.officebites-browser-build',
    rolldownOptions: { input: ['index.html', 'checks/browser-harness.html'] },
  },
};
