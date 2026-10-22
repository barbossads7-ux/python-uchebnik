// Messages between the page and python.worker.ts.

export type OutputKind = 'out' | 'err' | 'echo'

export interface OutputChunk {
  kind: OutputKind
  text: string
}

export interface PyError {
  /** Python exception class name; 'NoInput' when input() ran out of lines. */
  type: string
  message: string
  /** 1-based line in the user's code, when known. */
  line: number | null
}

export type ToWorker =
  | { type: 'init'; indexURL: string }
  | { type: 'run'; id: number; code: string; stdin: string[]; echo: boolean }

export type FromWorker =
  | { type: 'ready' }
  | { type: 'load-error'; message: string }
  | { type: 'output'; id: number; chunks: OutputChunk[] }
  | { type: 'done'; id: number; error: PyError | null; truncated: boolean; fatal: boolean }
