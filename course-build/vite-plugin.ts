// Exposes the parsed course as `virtual:course`. Editing content/*.md reloads the dev page.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { buildCourse, CONTENT_FILES } from './parse.ts'

const VIRTUAL_ID = 'virtual:course'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export function coursePlugin(root: string): Plugin {
  const files = [resolve(root, CONTENT_FILES.theory), resolve(root, CONTENT_FILES.tasks)]
  return {
    name: 'course',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      for (const f of files) this.addWatchFile(f)
      const [theory, tasks] = files.map((f) => readFileSync(f, 'utf8'))
      return `export default ${JSON.stringify(buildCourse(theory, tasks))}`
    },
    handleHotUpdate({ file, server }) {
      if (!files.includes(resolve(file))) return
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}
