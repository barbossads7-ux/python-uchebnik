// Runs Python (Pyodide) off the main thread, so an endless loop can't freeze the page:
// the page simply terminates this worker on timeout or «Стоп».
import type { PyodideAPI } from 'pyodide'
import type { FromWorker, OutputChunk, OutputKind, PyError, ToWorker } from './protocol'

const post = (msg: FromWorker) => (self as unknown as { postMessage(m: FromWorker): void }).postMessage(msg)

/** Defines __run(code, stdin_lines, echo, emit_echo) → None | {type, message, line}. */
const RUNNER = String.raw`
import ast, builtins, sys, traceback

class _NoInput(EOFError):
    pass

def _wrap_expr(node):
    # Top-level expression → __echo__(expression), like the interactive console shows values.
    if isinstance(node, ast.Expr):
        call = ast.Call(func=ast.Name(id="__echo__", ctx=ast.Load()), args=[node.value], keywords=[])
        return ast.copy_location(ast.Expr(value=call), node)
    return node

def __run(code, stdin_lines, echo, emit_echo):
    lines = iter(list(stdin_lines))

    def _input(prompt=""):
        sys.stdout.write(str(prompt))
        try:
            value = next(lines)
        except StopIteration:
            sys.stdout.write("\n")
            sys.stdout.flush()
            raise _NoInput("не хватает ввода") from None
        sys.stdout.write(value + "\n")
        sys.stdout.flush()
        return value

    def _echo(value):
        if value is not None:
            sys.stdout.flush()
            emit_echo(repr(value) + "\n")

    ns = {"__name__": "__main__", "__builtins__": builtins, "input": _input, "__echo__": _echo}
    try:
        tree = ast.parse(code, "<code>", "exec")
        if echo:
            tree.body = [_wrap_expr(node) for node in tree.body]
            ast.fix_missing_locations(tree)
        exec(compile(tree, "<code>", "exec"), ns)
    except SyntaxError as e:
        return {"type": type(e).__name__, "message": e.msg, "line": e.lineno}
    except SystemExit:
        pass
    except BaseException as e:
        line = None
        for frame, lineno in traceback.walk_tb(e.__traceback__):
            if frame.f_code.co_filename == "<code>":
                line = lineno
        name = "NoInput" if isinstance(e, _NoInput) else type(e).__name__
        return {"type": name, "message": str(e), "line": line}
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
    return None
`

/** Output is capped so a print loop can't flood the page before the timeout hits. */
const OUTPUT_LIMIT = 100_000
const FLUSH_MS = 50

let pyodide: PyodideAPI | null = null
let runId = 0
let chunks: OutputChunk[] = []
let total = 0
let truncated = false
let lastFlush = 0

function flush() {
  if (chunks.length) post({ type: 'output', id: runId, chunks })
  chunks = []
  lastFlush = Date.now()
}

function emit(kind: OutputKind, text: string) {
  if (truncated || !text) return
  if (total + text.length > OUTPUT_LIMIT) {
    text = text.slice(0, OUTPUT_LIMIT - total)
    truncated = true
  }
  total += text.length
  const last = chunks[chunks.length - 1]
  if (last?.kind === kind) last.text += text
  else chunks.push({ kind, text })
  // Python runs synchronously here, so timers can't fire: flush by elapsed time on each write.
  if (truncated || Date.now() - lastFlush > FLUSH_MS) flush()
}

function writer(kind: OutputKind) {
  const decoder = new TextDecoder()
  return {
    // isatty → line-buffered stdout, so output of a long loop arrives before the timeout.
    isatty: true,
    write(buffer: Uint8Array) {
      emit(kind, decoder.decode(buffer, { stream: true }))
      return buffer.length
    },
  }
}

type PyodideModule = { loadPyodide: (opts: { indexURL: string }) => Promise<PyodideAPI> }

/**
 * Up to 3 attempts: a first request on a cold connection sometimes fails (seen in Chrome on a fresh profile).
 * The browser remembers a failed import() per URL, so each retry adds a query to fetch for real.
 */
async function importWithRetry(url: string): Promise<PyodideModule> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await import(/* @vite-ignore */ attempt ? `${url}?retry=${attempt}` : url)
    } catch (e) {
      if (attempt >= 2) throw e
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
}

async function init(indexURL: string) {
  try {
    const mod = await importWithRetry(`${indexURL}pyodide.mjs`)
    const py = await mod.loadPyodide({ indexURL })
    py.setStdout(writer('out'))
    py.setStderr(writer('err'))
    py.runPython(RUNNER)
    pyodide = py
    post({ type: 'ready' })
  } catch (e) {
    post({ type: 'load-error', message: e instanceof Error ? e.message : String(e) })
  }
}

function run(id: number, code: string, stdin: string[], echo: boolean) {
  runId = id
  chunks = []
  total = 0
  truncated = false
  lastFlush = Date.now()
  let error: PyError | null = null
  let fatal = false
  const py = pyodide!
  const runFn = py.globals.get('__run')
  const lines = py.toPy(stdin)
  try {
    const result = runFn(code, lines, echo, (text: string) => emit('echo', text))
    if (result) {
      error = result.toJs({ dict_converter: Object.fromEntries }) as PyError
      result.destroy()
    }
  } catch (e) {
    // Errors outside the user's code (e.g. JS stack overflow) can break the interpreter: the page restarts the worker.
    fatal = true
    error = { type: 'InternalError', message: e instanceof Error ? e.message : String(e), line: null }
  } finally {
    lines.destroy()
    runFn.destroy()
  }
  flush()
  post({ type: 'done', id, error, truncated, fatal })
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data
  if (msg.type === 'init') void init(msg.indexURL)
  else if (msg.type === 'run') run(msg.id, msg.code, msg.stdin, msg.echo)
}
