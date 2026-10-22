import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { OutputChunk } from './protocol'
import { runPython, stopPython, useRunner, type RunResult } from './runner'

export const USES_INPUT = /\binput\s*\(/

/** Textarea → input() lines; a trailing newline doesn't add an empty value. */
export function toLines(text: string): string[] {
  return text === '' ? [] : text.replace(/\r/g, '').replace(/\n$/, '').split('\n')
}

function append(prev: OutputChunk[], next: OutputChunk[]): OutputChunk[] {
  const out = prev.slice()
  for (const c of next) {
    const last = out[out.length - 1]
    if (last?.kind === c.kind) out[out.length - 1] = { kind: c.kind, text: last.text + c.text }
    else out.push(c)
  }
  return out
}

/** Run state of one code block or editor. */
export function useRun() {
  const owner = useId()
  const runner = useRunner()
  const [output, setOutput] = useState<OutputChunk[]>([])
  const [result, setResult] = useState<RunResult | null>(null)
  /** The code that was actually run — error line numbers refer to it. */
  const [ranCode, setRanCode] = useState('')
  const [started, setStarted] = useState(false)

  const mine = runner.busy === owner
  const loading = mine && runner.python === 'loading'
  const running = mine && !loading
  const blocked = runner.busy !== null && !mine

  // Leaving the slide or the tasks screen mid-run must not keep an endless loop alive.
  const mineRef = useRef(mine)
  mineRef.current = mine
  useEffect(
    () => () => {
      if (mineRef.current) stopPython()
    },
    [],
  )

  const start = useCallback(
    async (code: string, stdin: string, echo: boolean) => {
      setStarted(true)
      setOutput([])
      setResult(null)
      setRanCode(code)
      const r = await runPython({
        owner,
        code,
        stdin: toLines(stdin),
        echo,
        onOutput: (chunks) => setOutput((prev) => append(prev, chunks)),
      })
      setResult(r)
    },
    [owner],
  )

  return { start, stop: stopPython, output, result, ranCode, started, loading, running, blocked }
}

export type RunState = ReturnType<typeof useRun>
