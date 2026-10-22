import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Block, Level, Task } from '../course/types'
import { USES_INPUT, useRun } from '../python/useRun'
import { getProgress, saveTaskDraft, setTaskSolved, useProgress } from '../storage'
import { Blocks } from './Blocks'
import type { EditorHandle } from './CodeEditor'
import { RunBar, RunOutput, StdinField } from './Run'

const LEVEL_LABEL: Record<Level, string> = {
  easy: '🟢 простое',
  medium: '🟡 посложнее',
  hard: '🔴 со звёздочкой',
}

// CodeMirror is ~130 KB gzipped: load it only when a tasks screen opens, not on the home page or slides.
const CodeEditor = lazy(() => import('./CodeEditor').then((m) => ({ default: m.CodeEditor })))

const SAVE_DELAY_MS = 400
const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

const pythonCode = (blocks: Block[]) =>
  blocks
    .filter((b) => b.type === 'code' && b.lang === 'python')
    .map((b) => (b.type === 'code' ? b.code : ''))
    .join('\n\n')

export function TaskCard({ task }: { task: Task }) {
  // Data from the task statement (1.3, 3.3) is a ready start; otherwise the editor starts empty.
  const starter = pythonCode(task.statement)
  const solution = pythonCode(task.solution) || null
  const saved = useRef(getProgress().tasks[task.id]).current
  const solved = !!useProgress().tasks[task.id]?.solved

  const editor = useRef<EditorHandle>(null)
  const [code, setCode] = useState(saved?.code ?? starter)
  const [stdin, setStdin] = useState(saved?.stdin ?? '')
  /** Student's code before «Загрузить в редактор», to put it back. */
  const [restore, setRestore] = useState<string | null>(null)
  const run = useRun()

  // Save the draft shortly after typing stops, and on leaving the page / closing the tab.
  const draft = useRef({ code, stdin, dirty: false })
  useEffect(() => {
    if (!draft.current.dirty) return
    const t = setTimeout(() => {
      saveTaskDraft(task.id, draft.current.code, draft.current.stdin)
      draft.current.dirty = false
    }, SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [code, stdin, task.id])
  useEffect(() => {
    const flush = () => {
      if (!draft.current.dirty) return
      saveTaskDraft(task.id, draft.current.code, draft.current.stdin)
      draft.current.dirty = false
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [task.id])

  const changeCode = (v: string) => {
    draft.current = { ...draft.current, code: v, dirty: true }
    setCode(v)
  }
  const changeStdin = (v: string) => {
    draft.current = { ...draft.current, stdin: v, dirty: true }
    setStdin(v)
  }

  const start = () => void run.start(draft.current.code, draft.current.stdin, false)

  const loadSolution = () => {
    if (!solution) return
    setRestore(code !== solution && code.trim() !== '' ? code : null)
    editor.current?.setValue(solution)
  }
  const putBack = () => {
    if (restore === null) return
    editor.current?.setValue(restore)
    setRestore(null)
  }

  const showStdin = stdin !== '' || USES_INPUT.test(code) || USES_INPUT.test(solution ?? '')

  return (
    <li className={solved ? 'task task--solved' : 'task'}>
      <div className="task__head">
        <h2 className="task__id">Задание {task.id}</h2>
        <span className={`level level--${task.level}`}>{LEVEL_LABEL[task.level]}</span>
        {solved && <span className="solved-chip">✓ Решено</span>}
      </div>

      <Blocks blocks={task.statement} />

      <div className="workbench">
        {showStdin && <StdinField value={stdin} onChange={changeStdin} />}
        <Suspense fallback={<div className="editor editor--loading">Загружаю редактор…</div>}>
          <CodeEditor ref={editor} initialValue={code} onChange={changeCode} onRun={start} label={`Код задания ${task.id}`} />
        </Suspense>
        <RunBar run={run} onRun={start} hint={`${MOD_KEY}+Enter — запустить · Esc, затем Tab — выйти из редактора`} />
        <RunOutput run={run} onRetry={start} />
      </div>

      {restore !== null && (
        <div className="restore" role="status">
          <span>Решение загружено в редактор.</span>
          <button type="button" className="btn btn--small btn--soft" onClick={putBack}>
            Вернуть мой код
          </button>
        </div>
      )}

      <details className="solution">
        <summary>Показать решение</summary>
        <div className="solution__body">
          <Blocks blocks={task.solution} />
          {solution && (
            <button type="button" className="btn btn--small btn--run" onClick={loadSolution}>
              Загрузить в редактор
            </button>
          )}
        </div>
      </details>

      <div className="task__foot">
        <button
          type="button"
          className={solved ? 'btn btn--small btn--soft' : 'btn btn--small btn--primary'}
          aria-pressed={solved}
          onClick={() => setTaskSolved(task.id, !solved)}
        >
          {solved ? 'Снять отметку' : '✓ Отметить решённым'}
        </button>
      </div>
    </li>
  )
}
