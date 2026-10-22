// `npm run dump` — prints how content/*.md was split, to check the parser without opening the site.
import { readFileSync } from 'node:fs'
import { buildCourse, CONTENT_FILES } from './parse.ts'

const course = buildCourse(readFileSync(CONTENT_FILES.theory, 'utf8'), readFileSync(CONTENT_FILES.tasks, 'utf8'))
for (const t of course.topics) {
  console.log(`Тема ${t.n}. ${t.title} — слайдов: ${t.slides.length}, заданий: ${t.tasks.length}`)
  t.slides.forEach((s, i) => {
    const code = s.blocks.filter((b) => b.type === 'code').length
    console.log(`  ${i + 1}. ${s.titleText}  [блоков: ${s.blocks.length}, кода: ${code}]`)
  })
  for (const task of t.tasks) {
    const solCode = task.solution.filter((b) => b.type === 'code').map((b) => b.lang || 'text')
    console.log(`  · ${task.id} ${task.level}  условие: ${task.statement.length} бл., решение: ${solCode.join(', ')}`)
  }
}
console.log('Сноска:', course.footnoteHtml.replace(/<[^>]+>/g, '').trim())
