import type { CodeBlock as CodeBlockData } from '../course/types'

// HTML here is produced at build time from our own content/*.md, so it is trusted.
export function CodeBlock({ block }: { block: CodeBlockData }) {
  return (
    <pre className={block.lang === 'python' ? 'code' : 'code code--plain'}>
      <code dangerouslySetInnerHTML={{ __html: block.html }} />
    </pre>
  )
}
