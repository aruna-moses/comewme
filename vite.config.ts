import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Identifies this exact build. It is baked into the JS bundle and also written
 * to /version.json, so a tab that has been open since the last deploy can tell
 * that a newer one is live.
 */
const buildId =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12) || Date.now().toString(36)

function emitVersionFile(): Plugin {
  return {
    name: 'comewme-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId, builtAt: new Date().toISOString() }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersionFile()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  server: { port: 5173 },
})
