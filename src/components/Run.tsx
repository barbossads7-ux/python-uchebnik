// Building blocks shared by slide examples and the task editor.
import { describeError } from '../python/errors'
import { RUN_TIMEOUT_MS, type RunResult } from '../python/runner'
import type { RunState } from '../python/useRun'

export function StdinField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="stdin">
      <span className="stdin__label">Ввод (каждое значение с новой строки)</span>
      <textarea
        className="stdin__field"
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
      />
    </label>
  )
}

export function RunBar({ run, onRun, hint }: { run: RunState; onRun: () => void; hint?: string }) {
  return (
    <div className="run-bar">
      {run.running ? (
        <button type="button" className="btn btn--small btn--stop" onClick={run.stop}>
          <span aria-hidden="true">■</span> Стоп
        </button>
      ) : (
        <button type="button" className="btn btn--small btn--run" onClick={onRun} disabled={run.loading || run.blocked}>
          <span aria-hidden="true">▶</span> Запустить
        </button>
      )}
      <span className="run-bar__status" aria-live="polite">
        {run.loading && (
          <>
            <span className="spinner" aria-hidden="true" /> Загружаю Python… (~12 МБ, только в первый раз)
          </>
        )}
        {run.running && (
          <>
            <span className="spinner" aria-hidden="true" /> Выполняется…
          </>
        )}
        {run.blocked && 'Сейчас выполняется другой пример'}
        {!run.loading && !run.running && !run.blocked && hint && <span className="run-bar__hint">{hint}</span>}
      </span>
    </div>
  )
}

function ErrorBox({ result, code }: { result: Extract<RunResult, { kind: 'done' }>; code: string }) {
  if (!result.error) return null
  const d = describeError(result.error, code)
  return (
    <div className="run-error" role="alert">
      <p className="run-error__where">{d.where}</p>
      {d.source && <code className="run-error__source">{d.source}</code>}
      {d.hint && <p className="run-error__hint">{d.hint}</p>}
      <p className="run-error__tech">{d.technical}</p>
    </div>
  )
}

export function RunOutput({ run, onRetry }: { run: RunState; onRetry: () => void }) {
  const { result, output } = run
  if (!run.started || run.loading) return null
  if (result?.kind === 'load-failed') {
    return (
      <div className="output-panel">
        <div className="run-error" role="alert">
          <p className="run-error__where">Не удалось загрузить Python</p>
          <p className="run-error__hint">Проверь подключение к интернету и попробуй ещё раз.</p>
          <p className="run-error__tech">{result.message}</p>
          <button type="button" className="btn btn--small btn--run" onClick={onRetry} disabled={run.blocked}>
            Повторить
          </button>
        </div>
      </div>
    )
  }
  const finished = result?.kind === 'done' ? result : null
  const hasEcho = output.some((c) => c.kind === 'echo')
  return (
    <div className="output-panel">
      {output.length > 0 && (
        <pre className="output" aria-label="Вывод программы">
          {output.map((c, i) => (
            <span key={i} className={`output__${c.kind}`}>
              {c.text}
            </span>
          ))}
        </pre>
      )}
      {finished && !finished.error && output.length === 0 && <p className="output-note">Программа ничего не вывела.</p>}
      {finished?.truncated && <p className="output-note">Вывод слишком длинный — показано начало.</p>}
      {hasEcho && <p className="output-note">Цветом выделены значения выражений — как в консоли Python.</p>}
      {finished && <ErrorBox result={finished} code={run.ranCode} />}
      {result?.kind === 'timeout' && (
        <p className="output-note output-note--warn" role="alert">
          Программа работала дольше {RUN_TIMEOUT_MS / 1000} секунд и была остановлена. Возможно, цикл никогда не
          заканчивается.
        </p>
      )}
      {result?.kind === 'stopped' && <p className="output-note">Остановлено.</p>}
    </div>
  )
}
