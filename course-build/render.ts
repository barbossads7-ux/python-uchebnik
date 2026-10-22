// Markdown tokens → HTML blocks. Runs in Node at build time.
import { Marked, type Token } from 'marked'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import { parser as pythonParser } from '@lezer/python'
import type { Block, CodeBlock } from '../src/course/types.ts'

export const md = new Marked({ gfm: true })

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** "[дописано]" / "[дописано подробнее]" in the md become a small badge; the md itself is untouched. */
export function badges(html: string): string {
  return html.replace(/\[(дописано[^\]]*)\]/g, '<span class="badge">$1</span>')
}

/** Same tokenizer (@lezer/python) and class names as CodeMirror will use in the editor. */
function highlightPython(code: string): string {
  let html = ''
  highlightCode(
    code,
    pythonParser.parse(code),
    classHighlighter,
    (text, classes) => {
      html += classes ? `<span class="${classes}">${escapeHtml(text)}</span>` : escapeHtml(text)
    },
    () => {
      html += '\n'
    },
  )
  return html
}

/** Lezer is error-tolerant; an error node means Python itself would reject the code (a syntax sketch, not a program). */
function parsesAsPython(code: string): boolean {
  let ok = true
  pythonParser.parse(code).iterate({
    enter: (node) => {
      if (node.type.isError) ok = false
      return ok
    },
  })
  return ok
}

export function codeBlock(lang: string, code: string): CodeBlock {
  const python = lang === 'python'
  const html = python ? highlightPython(code) : escapeHtml(code)
  return { type: 'code', lang, code, html, runnable: python && parsesAsPython(code) }
}

/** Groups tokens into blocks: code fences stay separate, everything between them becomes one HTML block. */
export function toBlocks(tokens: Token[]): Block[] {
  const blocks: Block[] = []
  let buf: Token[] = []
  const flush = () => {
    if (buf.length) blocks.push({ type: 'html', html: badges(md.parser(buf)) })
    buf = []
  }
  for (const t of tokens) {
    if (t.type === 'space') continue
    if (t.type === 'code') {
      flush()
      blocks.push(codeBlock(t.lang ?? '', t.text))
    } else {
      buf.push(t)
    }
  }
  flush()
  return blocks
}

export function inlineHtml(src: string): string {
  return badges(md.parseInline(src) as string)
}

/** Plain-text version of an inline md string (for document.title etc.). */
export function inlineText(src: string): string {
  return src
    .replace(/\[дописано[^\]]*\]/g, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
