import type { Block } from '../course/types'
import { CodeBlock } from './CodeBlock'
import { RunnableCode } from './RunnableCode'

// HTML here is produced at build time from our own content/*.md, so it is trusted.

/** `runnable`: python examples get «▶ Запустить» (slides); off where running makes no sense (task statements). */
export function Blocks({ blocks, runnable = false }: { blocks: Block[]; runnable?: boolean }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'html') return <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: b.html }} />
        if (runnable && b.runnable) return <RunnableCode key={i} block={b} />
        if (runnable && b.lang === 'python') {
          return (
            <div key={i} className="runnable">
              <CodeBlock block={b} />
              <p className="output-note">Это схема записи, а не программа — запускать нечего.</p>
            </div>
          )
        }
        return <CodeBlock key={i} block={b} />
      })}
    </>
  )
}
