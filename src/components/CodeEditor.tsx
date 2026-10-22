// CodeMirror 6 editor for Python. Highlighting uses the same classHighlighter as the slides (styles/code.css).
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorSelection, EditorState, Prec } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  type KeyBinding,
} from '@codemirror/view'
import { classHighlighter } from '@lezer/highlight'

export interface EditorHandle {
  /** Replaces the whole text as one undoable change. */
  setValue(text: string): void
  focus(): void
}

const INDENT = 4

/** Tab: without a selection insert spaces up to the next multiple of 4; with a selection indent the lines. */
const tabBinding: KeyBinding = {
  key: 'Tab',
  run: (view) => {
    const { state } = view
    if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view)
    view.dispatch(
      state.changeByRange((range) => {
        const col = range.head - state.doc.lineAt(range.head).from
        const spaces = ' '.repeat(INDENT - (col % INDENT))
        return { changes: { from: range.head, insert: spaces }, range: EditorSelection.cursor(range.head + spaces.length) }
      }),
      { scrollIntoView: true, userEvent: 'input' },
    )
    return true
  },
  shift: indentLess,
}

const theme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--text)',
    border: '1px solid var(--code-border)',
    borderRadius: 'var(--radius-md)',
  },
  '&.cm-focused': { outline: '3px solid var(--focus)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.6', borderRadius: 'inherit' },
  '.cm-content, .cm-gutter': { minHeight: '10em' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--text)' },
  '.cm-line': { padding: '0 14px 0 6px' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', paddingLeft: '6px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent-strong)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--accent-soft)',
    outline: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
  },
  '.cm-placeholder': { color: 'var(--text-muted)', fontStyle: 'italic' },
})

interface Props {
  initialValue: string
  onChange: (value: string) => void
  /** Ctrl/Cmd+Enter. */
  onRun: () => void
  label: string
  ref?: Ref<EditorHandle>
}

export function CodeEditor({ initialValue, onChange, onRun, label, ref }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const callbacks = useRef({ onChange, onRun })
  callbacks.current = { onChange, onRun }
  const initial = useRef(initialValue)

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          python(),
          syntaxHighlighting(classHighlighter),
          indentUnit.of(' '.repeat(INDENT)),
          EditorState.tabSize.of(INDENT),
          placeholder('# Напиши решение здесь'),
          Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => (callbacks.current.onRun(), true) }])),
          keymap.of([tabBinding, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.contentAttributes.of({ 'aria-label': label, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.onChange(u.state.doc.toString())
          }),
          theme,
        ],
      }),
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
  }, [label])

  useImperativeHandle(ref, () => ({
    setValue(text) {
      const v = view.current
      if (!v) return
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text }, selection: EditorSelection.cursor(0) })
    },
    focus() {
      view.current?.focus()
    },
  }))

  return <div className="editor" ref={host} />
}
