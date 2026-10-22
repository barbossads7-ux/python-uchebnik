// Shape of the course data produced at build time by course-build/ from content/*.md.

export interface HtmlBlock {
  type: 'html'
  html: string
}

export interface CodeBlock {
  type: 'code'
  /** Fence language as written in md ('python', or '' for plain text). */
  lang: string
  /** Source code exactly as in md — used later for running and the editor. */
  code: string
  /** Highlighted HTML (tok-* classes from @lezer/highlight classHighlighter). */
  html: string
  /** Python that parses (a «▶ Запустить» button makes sense); false for plain text and syntax sketches. */
  runnable: boolean
}

export type Block = HtmlBlock | CodeBlock

export interface Slide {
  titleHtml: string
  titleText: string
  blocks: Block[]
}

export type Level = 'easy' | 'medium' | 'hard'

export interface Task {
  /** "N.M" as in md. */
  id: string
  level: Level
  statement: Block[]
  solution: Block[]
}

export interface Topic {
  n: number
  title: string
  slides: Slide[]
  tasks: Task[]
}

export interface Course {
  introHtml: string
  footnoteHtml: string
  topics: Topic[]
}
