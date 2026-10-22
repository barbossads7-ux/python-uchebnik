import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { coursePlugin } from './course-build/vite-plugin.ts'
import { workerSourcePlugin } from './course-build/worker-source-plugin.ts'

const root = fileURLToPath(new URL('.', import.meta.url))
// The runtime comes from the official CDN; its version is the one pinned for the `pyodide` types package.
const pyodideVersion: string = JSON.parse(readFileSync(new URL('./node_modules/pyodide/package.json', import.meta.url), 'utf8')).version

// `npm run build:single` (mode "single"): everything — JS, CSS, fonts, course data — in one HTML file.
export default defineConfig(({ mode }) => ({
  // Relative asset paths: the built site works from any folder or static host.
  base: './',
  plugins: [react(), coursePlugin(root), workerSourcePlugin(root), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
  define: { __PYODIDE_VERSION__: JSON.stringify(pyodideVersion) },
}))
