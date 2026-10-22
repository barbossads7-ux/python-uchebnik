import { useState } from 'react'
import type { CodeBlock as CodeBlockData } from '../course/types'
import { USES_INPUT, useRun } from '../python/useRun'
import { CodeBlock } from './CodeBlock'
import { RunBar, RunOutput, StdinField } from './Run'

/** A slide example: read-only code + «▶ Запустить»; values of top-level expressions are echoed. */
export function RunnableCode({ block }: { block: CodeBlockData }) {
  const run = useRun()
  const [stdin, setStdin] = useState('')
  const start = () => void run.start(block.code, stdin, true)

  return (
    <div className="runnable">
      <CodeBlock block={block} />
      {USES_INPUT.test(block.code) && <StdinField value={stdin} onChange={setStdin} />}
      <RunBar run={run} onRun={start} />
      <RunOutput run={run} onRetry={start} />
    </div>
  )
}
