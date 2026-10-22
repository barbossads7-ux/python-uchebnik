// Exposes src/python/python.worker.ts, compiled to JS, as a string (`virtual:python-worker-source`).
// The page starts the worker from a data: URL — the only kind of module worker Chrome allows on a page
// opened from disk (file://); blob: workers fail there. The source stays TypeScript and is checked by tsc.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformWithOxc, type Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:python-worker-source'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export function workerSourcePlugin(root: string): Plugin {
  const file = resolve(root, 'src/python/python.worker.ts')
  return {
    name: 'python-worker-source',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    async load(id) {
      if (id !== RESOLVED_ID) return
      this.addWatchFile(file)
      const { code } = await transformWithOxc(readFileSync(file, 'utf8'), file, { lang: 'ts' })
      if (/^\s*(import\s[^\n]*\sfrom\s+|import\s+)['"]/m.test(code)) throw new Error('python.worker.ts must not have runtime imports: it runs from a data: URL')
      return `export default ${JSON.stringify(code)}`
    },
    handleHotUpdate({ file: changed, server }) {
      if (resolve(changed) !== file) return
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}
