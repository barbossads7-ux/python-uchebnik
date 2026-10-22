// Page side of the Python runner: one lazily created worker, one run at a time.
import { useSyncExternalStore } from 'react'
import type { FromWorker, OutputChunk, PyError, ToWorker } from './protocol'
import workerSource from 'virtual:python-worker-source'

const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${__PYODIDE_VERSION__}/full/`
export const RUN_TIMEOUT_MS = 5000
const LOAD_TIMEOUT_MS = 90_000

export type RunResult =
  | { kind: 'done'; error: PyError | null; truncated: boolean }
  | { kind: 'timeout' }
  | { kind: 'stopped' }
  | { kind: 'load-failed'; message: string }

export interface RunnerState {
  /** Pyodide in the current worker: not loaded yet, downloading, ready. */
  python: 'idle' | 'loading' | 'ready'
  /** Owner key of the run in progress (one at a time across the page). */
  busy: string | null
}

let state: RunnerState = { python: 'idle', busy: null }
const listeners = new Set<() => void>()

function setState(patch: Partial<RunnerState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useRunner(): RunnerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

let worker: Worker | null = null
let ready: Promise<Worker> | null = null
let seq = 0
interface ActiveRun {
  id: number
  onOutput: (chunks: OutputChunk[]) => void
  /** Set once Python is loaded and the code is sent to the worker. */
  resolve?: (r: RunResult) => void
  timer?: ReturnType<typeof setTimeout>
}
let current: ActiveRun | null = null

function send(w: Worker, msg: ToWorker) {
  w.postMessage(msg)
}

function dropWorker() {
  worker?.terminate()
  worker = null
  ready = null
  setState({ python: 'idle' })
}

function finish(result: RunResult) {
  const run = current
  if (!run) return
  clearTimeout(run.timer)
  current = null
  setState({ busy: null })
  run.resolve?.(result)
}

function onMessage(e: MessageEvent<FromWorker>) {
  const msg = e.data
  if (!current || !('id' in msg) || msg.id !== current.id) return
  if (msg.type === 'output') current.onOutput(msg.chunks)
  else if (msg.type === 'done') {
    if (msg.fatal) dropWorker()
    finish({ kind: 'done', error: msg.error, truncated: msg.truncated })
  }
}

function ensureReady(): Promise<Worker> {
  if (ready) return ready
  setState({ python: 'loading' })
  ready = new Promise<Worker>((resolve, reject) => {
    // data: URL, not a file or blob: works on http(s) and in the single HTML opened from disk (see worker-source-plugin.ts).
    const w = new Worker(`data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`, { type: 'module' })
    const fail = (message: string) => {
      clearTimeout(timer)
      w.terminate()
      ready = null
      setState({ python: 'idle' })
      reject(new Error(message))
    }
    const timer = setTimeout(() => fail('Python не загрузился за 90 секунд'), LOAD_TIMEOUT_MS)
    w.onerror = (e) => fail(e.message || 'не удалось запустить воркер')
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      if (e.data.type === 'load-error') return fail(e.data.message)
      if (e.data.type !== 'ready') return
      clearTimeout(timer)
      w.onmessage = onMessage
      w.onerror = null
      worker = w
      setState({ python: 'ready' })
      resolve(w)
    }
    send(w, { type: 'init', indexURL: INDEX_URL })
  })
  return ready
}

export interface RunOptions {
  /** Who started the run (shown as busy for that block only). */
  owner: string
  code: string
  stdin: string[]
  /** Print values of top-level expressions, like the Python console. */
  echo: boolean
  onOutput: (chunks: OutputChunk[]) => void
}

/** Loads Python on first use, then runs the code with a timeout. Never rejects. */
export async function runPython(opts: RunOptions): Promise<RunResult> {
  if (current) return { kind: 'stopped' }
  const run: ActiveRun = { id: ++seq, onOutput: opts.onOutput }
  current = run
  setState({ busy: opts.owner })
  let w: Worker
  try {
    w = await ensureReady()
  } catch (e) {
    current = null
    setState({ busy: null })
    return { kind: 'load-failed', message: e instanceof Error ? e.message : String(e) }
  }
  if (current !== run) return { kind: 'stopped' }
  return new Promise<RunResult>((resolve) => {
    run.resolve = resolve
    run.timer = setTimeout(() => {
      dropWorker()
      finish({ kind: 'timeout' })
    }, RUN_TIMEOUT_MS)
    send(w, { type: 'run', id: run.id, code: opts.code, stdin: opts.stdin, echo: opts.echo })
  })
}

/** «Стоп»: the only way to interrupt Python here is to kill the worker; the next run reloads it (from the browser cache). */
export function stopPython() {
  if (!current?.resolve) return
  dropWorker()
  finish({ kind: 'stopped' })
}
