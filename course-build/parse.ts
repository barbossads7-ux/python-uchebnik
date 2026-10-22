// content/*.md → Course. Runs in Node at build time; any format surprise throws and fails the build.
import type { Token, Tokens } from 'marked'
import type { Course, Level, Slide, Task, Topic } from '../src/course/types.ts'
import { badges, inlineHtml, inlineText, md, toBlocks } from './render.ts'

const THEORY_FILE = 'content/01_teoriya_python.md'
const TASKS_FILE = 'content/02_zadaniya_python.md'

const TOPIC_RE = /^Тема (\d+)\.\s+(.+)$/
const TASK_START_RE = /^\*\*\d+\.\d+/
const TASK_RE = /^\*\*(\d+)\.(\d+)\s+(🟢|🟡|🔴)\*\*\s*/u
const SOLUTION_RE = /^(\d+)\.(\d+)$/
const LEVELS: Record<string, Level> = { '🟢': 'easy', '🟡': 'medium', '🔴': 'hard' }

/** Approximate screen budget for topics without ### (in text lines). */
const SLIDE_BUDGET = 22
const CHARS_PER_LINE = 55

class ContentError extends Error {
  constructor(file: string, message: string) {
    super(`[${file}] ${message}`)
    this.name = 'ContentError'
  }
}

const isHeading = (t: Token, depth: number): t is Tokens.Heading => t.type === 'heading' && t.depth === depth
const hasCode = (tokens: Token[]) => tokens.some((t) => t.type === 'code')
const lex = (src: string) => md.lexer(src).filter((t) => t.type !== 'space')

function slide(titleSrc: string, tokens: Token[]): Slide {
  return { titleHtml: inlineHtml(titleSrc), titleText: inlineText(titleSrc), blocks: toBlocks(tokens) }
}

/** Splits a token list at every token matching `isStart`; returns [before-first, ...groups]. */
function splitAt<T extends Token>(tokens: Token[], isStart: (t: Token) => t is T): [Token[], { head: T; body: Token[] }[]] {
  const before: Token[] = []
  const groups: { head: T; body: Token[] }[] = []
  for (const t of tokens) {
    if (isStart(t)) groups.push({ head: t, body: [] })
    else if (groups.length) groups[groups.length - 1].body.push(t)
    else before.push(t)
  }
  return [before, groups]
}

// ---------- theory ----------

/** Rough height of a token in text lines, to cut topics without ### into "about a screen" slides. */
function estimate(t: Token): number {
  const lines = (s: string) => Math.max(1, Math.ceil(s.trim().length / CHARS_PER_LINE))
  switch (t.type) {
    case 'code':
      return t.text.split('\n').length + 2
    case 'list':
      return 1 + (t as Tokens.List).items.reduce((sum, item) => sum + lines(item.text), 0)
    case 'table':
      return (t as Tokens.Table).rows.length + 2
    default:
      return 1 + lines(t.raw)
  }
}

const sizeOf = (tokens: Token[]) => tokens.reduce((s, t) => s + estimate(t), 0)

/** A paragraph ending with ":" is glued to the block after it ("Правила:" + list). */
function toUnits(tokens: Token[]): Token[][] {
  const units: Token[][] = []
  let glue = false
  for (const t of tokens) {
    if (glue) units[units.length - 1].push(t)
    else units.push([t])
    glue = t.type === 'paragraph' && t.text.trim().endsWith(':')
  }
  return units
}

function sliceList(list: Tokens.List, from: number, to: number): Tokens.List {
  const start = typeof list.start === 'number' ? list.start + from : list.start
  return { ...list, items: list.items.slice(from, to), start }
}

/** Packs units into pages of ~SLIDE_BUDGET lines; a single oversized unit ending in a list is split by items. */
function pack(tokens: Token[]): Token[][] {
  const pages: Token[][] = []
  let cur: Token[] = []
  let used = 0
  const flush = () => {
    if (cur.length) pages.push(cur)
    cur = []
    used = 0
  }
  for (const unit of toUnits(tokens)) {
    const size = sizeOf(unit)
    if (used + size <= SLIDE_BUDGET) {
      cur.push(...unit)
      used += size
      continue
    }
    flush()
    const last = unit[unit.length - 1]
    if (size <= SLIDE_BUDGET || last.type !== 'list') {
      cur.push(...unit)
      used = size
      continue
    }
    // Oversized "intro + list": split the list into balanced parts (by item midpoints), numbering continues.
    const list = last as Tokens.List
    const lead = unit.slice(0, -1)
    const share = size / Math.ceil(size / SLIDE_BUDGET)
    let offset = sizeOf(lead) + 1
    const partOf = list.items.map((item) => {
      const s = Math.max(1, Math.ceil(item.text.trim().length / CHARS_PER_LINE))
      const part = Math.floor((offset + s / 2) / share)
      offset += s
      return part
    })
    cur.push(...lead)
    let from = 0
    for (let i = 1; i <= list.items.length; i++) {
      if (i < list.items.length && partOf[i] === partOf[from]) continue
      cur.push(sliceList(list, from, i))
      if (i < list.items.length) flush()
      from = i
    }
    used = SLIDE_BUDGET
  }
  flush()
  return pages
}

const isBoldLead = (t: Token): t is Tokens.Paragraph =>
  t.type === 'paragraph' && (t as Tokens.Paragraph).tokens?.[0]?.type === 'strong'

function boldTitle(p: Tokens.Paragraph): string {
  const strong = p.tokens[0] as Tokens.Strong
  return strong.text.trim().replace(/[.:]+$/, '').trim()
}

/** Topic without ###: cut at bold-led paragraphs, merge code-less chunks forward, then fit to ~a screen. */
function slidesByMeaning(topicTitle: string, tokens: Token[]): Slide[] {
  const chunks: { title?: string; tokens: Token[] }[] = []
  for (const t of tokens) {
    const last = chunks[chunks.length - 1]
    if (isBoldLead(t) && last && last.tokens.length) chunks.push({ title: boldTitle(t), tokens: [t] })
    else if (last) last.tokens.push(t)
    else chunks.push({ title: isBoldLead(t) ? boldTitle(t) : undefined, tokens: [t] })
  }
  const merged: typeof chunks = []
  let carry: (typeof chunks)[number] | null = null
  for (const c of chunks) {
    const chunk: (typeof chunks)[number] = carry ? { title: carry.title, tokens: [...carry.tokens, ...c.tokens] } : c
    carry = null
    if (!hasCode(chunk.tokens) && c !== chunks[chunks.length - 1]) carry = chunk
    else merged.push(chunk)
  }
  return merged.flatMap((c) => pack(c.tokens).map((page) => slide(c.title ?? topicTitle, page)))
}

function topicSlides(n: number, title: string, tokens: Token[]): Slide[] {
  const [intro, sections] = splitAt(tokens, (t): t is Tokens.Heading => isHeading(t, 3))
  if (!sections.length) return slidesByMeaning(title, tokens)

  if (intro.length && !hasCode(intro)) sections[0].body = [...intro, ...sections[0].body]
  const slides = sections.map((s) => slide(s.head.text, s.body))
  if (intro.length && hasCode(intro)) slides.unshift(slide(title, intro))
  for (const [i, s] of slides.entries()) {
    if (!s.blocks.length) throw new ContentError(THEORY_FILE, `Тема ${n}: пустой слайд №${i + 1} «${s.titleText}»`)
  }
  return slides
}

function parseTheory(src: string) {
  const tokens = lex(src)
  if (!tokens.length || !isHeading(tokens[0], 1)) throw new ContentError(THEORY_FILE, 'файл должен начинаться с заголовка «# …»')
  if (tokens.slice(1).some((t) => isHeading(t, 1))) throw new ContentError(THEORY_FILE, 'ожидался ровно один заголовок «# …»')

  const [preamble, groups] = splitAt(tokens.slice(1), (t): t is Tokens.Heading => isHeading(t, 2))
  const introPara = preamble.find((t) => t.type === 'paragraph')
  let footnote: Token[] = []

  const topics = groups.map(({ head, body }, k) => {
    const m = TOPIC_RE.exec(head.text.trim())
    if (!m) throw new ContentError(THEORY_FILE, `заголовок «## ${head.text}» не похож на «## Тема N. Название»`)
    const n = Number(m[1])
    if (n !== k + 1) throw new ContentError(THEORY_FILE, `темы должны идти по порядку: после ${k} идёт ${n}`)
    const hr = body.findIndex((t) => t.type === 'hr')
    const content = hr < 0 ? body : body.slice(0, hr)
    const rest = hr < 0 ? [] : body.slice(hr + 1).filter((t) => t.type !== 'hr')
    if (rest.length) {
      if (k !== groups.length - 1) throw new ContentError(THEORY_FILE, `Тема ${n}: текст после «---» внутри темы`)
      footnote = rest
    }
    const title = inlineText(m[2])
    return { n, title, slides: topicSlides(n, title, content) }
  })
  if (!topics.length) throw new ContentError(THEORY_FILE, 'не найдено ни одной «## Тема N. …»')

  return {
    introHtml: introPara ? badges(md.parser([introPara])) : '',
    footnoteHtml: footnote.length ? badges(md.parser(footnote)) : '',
    topics,
  }
}

// ---------- tasks ----------

function parseTasks(src: string) {
  const tokens = lex(src)
  const h1 = tokens.flatMap((t, i) => (isHeading(t, 1) ? [i] : []))
  if (h1.length !== 2 || h1[0] !== 0) {
    throw new ContentError(TASKS_FILE, 'ожидались ровно два заголовка «# …»: название файла и раздел решений')
  }
  const [, sections] = splitAt(tokens.slice(1, h1[1]), (t): t is Tokens.Heading => isHeading(t, 2))
  const tasksByTopic = new Map<number, Omit<Task, 'solution'>[]>()

  for (const { head, body } of sections) {
    const m = TOPIC_RE.exec(head.text.trim())
    if (!m) throw new ContentError(TASKS_FILE, `заголовок «## ${head.text}» не похож на «## Тема N. Название»`)
    const n = Number(m[1])
    const content = body.filter((t) => t.type !== 'hr')
    const isTaskStart = (t: Token): t is Tokens.Paragraph => t.type === 'paragraph' && TASK_START_RE.test(t.raw)
    const [before, items] = splitAt(content, isTaskStart)
    if (before.length) throw new ContentError(TASKS_FILE, `Тема ${n}: текст до первого задания «**${n}.1 …**»`)
    tasksByTopic.set(
      n,
      items.map(({ head: p, body: rest }) => {
        const tm = TASK_RE.exec(p.raw)
        if (!tm) throw new ContentError(TASKS_FILE, `не разобран заголовок задания: ${p.raw.split('\n')[0]}`)
        const id = `${tm[1]}.${tm[2]}`
        if (Number(tm[1]) !== n) throw new ContentError(TASKS_FILE, `задание ${id} лежит в разделе темы ${n}`)
        return { id, level: LEVELS[tm[3]], statement: toBlocks([...lex(p.raw.slice(tm[0].length)), ...rest]) }
      }),
    )
  }

  const [beforeSolutions, solutionGroups] = splitAt(tokens.slice(h1[1] + 1), (t): t is Tokens.Heading => isHeading(t, 3))
  if (beforeSolutions.some((t) => t.type !== 'hr')) throw new ContentError(TASKS_FILE, 'текст в разделе решений до первого «### N.M»')
  const solutions = new Map<string, Token[]>()
  for (const { head, body } of solutionGroups) {
    const id = head.text.trim()
    if (!SOLUTION_RE.test(id)) throw new ContentError(TASKS_FILE, `заголовок решения «### ${id}» не похож на «### N.M»`)
    if (solutions.has(id)) throw new ContentError(TASKS_FILE, `решение ${id} встречается дважды`)
    solutions.set(id, body.filter((t) => t.type !== 'hr'))
  }

  const seen = new Set<string>()
  const result = new Map<number, Task[]>()
  for (const [n, list] of tasksByTopic) {
    result.set(
      n,
      list.map((t) => {
        if (seen.has(t.id)) throw new ContentError(TASKS_FILE, `задание ${t.id} встречается дважды`)
        seen.add(t.id)
        const sol = solutions.get(t.id)
        if (!sol?.length) throw new ContentError(TASKS_FILE, `у задания ${t.id} нет решения «### ${t.id}»`)
        return { ...t, solution: toBlocks(sol) }
      }),
    )
  }
  for (const id of solutions.keys()) {
    if (!seen.has(id)) throw new ContentError(TASKS_FILE, `решение ${id} без задания`)
  }

  return result
}

export function buildCourse(theorySrc: string, tasksSrc: string): Course {
  const theory = parseTheory(theorySrc)
  const tasks = parseTasks(tasksSrc)
  for (const n of tasks.keys()) {
    if (!theory.topics.some((t) => t.n === n)) throw new ContentError(TASKS_FILE, `задания для темы ${n}, которой нет в теории`)
  }
  const topics: Topic[] = theory.topics.map((t) => ({ ...t, tasks: tasks.get(t.n) ?? [] }))
  return { introHtml: theory.introHtml, footnoteHtml: theory.footnoteHtml, topics }
}

export const CONTENT_FILES = { theory: THEORY_FILE, tasks: TASKS_FILE }
