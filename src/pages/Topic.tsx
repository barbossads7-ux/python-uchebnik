import { useEffect, useRef, type PointerEvent } from 'react'
import course, { getTopic } from '../course'
import type { Topic } from '../course/types'
import { Blocks } from '../components/Blocks'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { href, navigate, type Route } from '../router'
import { getProgress, visitSlide, visitTasks } from '../storage'

function nextTopic(topic: Topic): Topic | undefined {
  return course.topics.find((t) => t.n === topic.n + 1)
}

/** Where to go after the theory part / after the tasks part of a topic. */
function afterTopic(topic: Topic): { route: Route; label: string } {
  const next = nextTopic(topic)
  return next
    ? { route: { name: 'slides', topic: next.n, slide: 1 }, label: 'Следующая тема' }
    : { route: { name: 'home' }, label: 'На главную' }
}

function TopicHeader({ topic, mode }: { topic: Topic; mode: 'slides' | 'tasks' }) {
  const slide = Math.min(getProgress().slides[topic.n]?.last ?? 1, topic.slides.length)
  return (
    <header className="topic-head">
      <a className="back" href={href({ name: 'home' })}>
        <span aria-hidden="true">←</span> Все темы
      </a>
      <p className="topic-head__eyebrow">Тема {topic.n}</p>
      <h1 className="topic-head__title">{topic.title}</h1>
      {topic.tasks.length > 0 && (
        <nav className="tabs" aria-label="Режим темы">
          <a
            className="tabs__item"
            href={href({ name: 'slides', topic: topic.n, slide })}
            aria-current={mode === 'slides' ? 'page' : undefined}
          >
            Теория
          </a>
          <a
            className="tabs__item"
            href={href({ name: 'tasks', topic: topic.n })}
            aria-current={mode === 'tasks' ? 'page' : undefined}
          >
            Задания
          </a>
        </nav>
      )}
    </header>
  )
}

function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  return {
    onPointerDown(e: PointerEvent) {
      // Mouse users have buttons and arrow keys; swiping inside code or tables scrolls them instead.
      if (e.pointerType === 'mouse' || (e.target as Element).closest('pre, table')) return
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    },
    onPointerUp(e: PointerEvent) {
      const s = start.current
      start.current = null
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) (dx < 0 ? onNext : onPrev)()
    },
    onPointerCancel() {
      start.current = null
    },
  }
}

function SlidesView({ topic, slide }: { topic: Topic; slide: number | null }) {
  const total = topic.slides.length
  const valid = slide !== null && slide >= 1 && slide <= total
  const current = valid ? slide : 1

  // #/topic/N resumes where the student stopped; out-of-range numbers are clamped.
  useEffect(() => {
    if (valid) return
    const target = slide === null ? (getProgress().slides[topic.n]?.last ?? 1) : slide
    navigate({ name: 'slides', topic: topic.n, slide: Math.min(Math.max(target, 1), total) }, { replace: true })
  }, [valid, slide, topic.n, total])

  const prevSlide = useRef(current)
  const direction = current >= prevSlide.current ? 'fwd' : 'back'
  useEffect(() => {
    prevSlide.current = current
  }, [current])

  const tasksNext = topic.tasks.length > 0
  const after = afterTopic(topic)
  const prevRoute: Route | null = current > 1 ? { name: 'slides', topic: topic.n, slide: current - 1 } : null
  const next: { route: Route; label: string } =
    current < total
      ? { route: { name: 'slides', topic: topic.n, slide: current + 1 }, label: 'Дальше' }
      : tasksNext
        ? { route: { name: 'tasks', topic: topic.n }, label: 'К заданиям' }
        : after

  const goPrev = () => prevRoute && navigate(prevRoute)
  const goNext = () => navigate(next.route)
  const handlers = useRef({ goPrev, goNext })
  handlers.current = { goPrev, goNext }

  useEffect(() => {
    if (!valid) return
    visitSlide(topic.n, current)
    document.title = `${topic.slides[current - 1].titleText} · Тема ${topic.n}`
    window.scrollTo({ top: 0 })
  }, [valid, topic, current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const el = e.target as HTMLElement
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'ArrowLeft') handlers.current.goPrev()
      else if (e.key === 'ArrowRight') handlers.current.goNext()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const swipe = useSwipe(goPrev, goNext)
  if (!valid) return null
  const data = topic.slides[current - 1]

  return (
    <main className="page topic">
      <TopicHeader topic={topic} mode="slides" />

      <div className="slide-progress">
        <span className="slide-progress__text">
          Слайд {current} / {total}
        </span>
        <ProgressBar value={current} max={total} label="Слайды темы" />
      </div>

      <article
        key={`${topic.n}-${current}`}
        className={`slide slide--${direction}`}
        aria-roledescription="слайд"
        aria-label={`${current} из ${total}`}
        {...swipe}
      >
        <h2 className="slide__title" dangerouslySetInnerHTML={{ __html: data.titleHtml }} />
        <Blocks blocks={data.blocks} runnable />
      </article>

      <nav className="slide-nav" aria-label="Слайды">
        {prevRoute ? (
          <a className="btn btn--soft" href={href(prevRoute)} aria-keyshortcuts="ArrowLeft">
            <span aria-hidden="true">←</span> Назад
          </a>
        ) : (
          <span className="btn btn--soft btn--disabled" aria-disabled="true">
            <span aria-hidden="true">←</span> Назад
          </span>
        )}
        <a className="btn btn--primary" href={href(next.route)} aria-keyshortcuts="ArrowRight">
          {next.label} <span aria-hidden="true">→</span>
        </a>
      </nav>
    </main>
  )
}

function TasksView({ topic }: { topic: Topic }) {
  useEffect(() => {
    visitTasks(topic.n)
    document.title = `Задания · Тема ${topic.n}`
    window.scrollTo({ top: 0 })
  }, [topic])

  const after = afterTopic(topic)

  return (
    <main className="page topic">
      <TopicHeader topic={topic} mode="tasks" />

      {topic.tasks.length === 0 ? (
        <p className="empty">В этой теме нет заданий — только теория.</p>
      ) : (
        <ol className="tasks">
          {topic.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ol>
      )}

      <nav className="slide-nav slide-nav--end" aria-label="Дальше">
        <a className="btn btn--primary" href={href(after.route)}>
          {after.label} <span aria-hidden="true">→</span>
        </a>
      </nav>
    </main>
  )
}

export function TopicPage({ route }: { route: Extract<Route, { name: 'slides' | 'tasks' }> }) {
  const topic = getTopic(route.topic)
  if (!topic) return <NotFound />
  return route.name === 'tasks' ? (
    <TasksView key={topic.n} topic={topic} />
  ) : (
    <SlidesView key={topic.n} topic={topic} slide={route.slide} />
  )
}

export function NotFound() {
  useEffect(() => {
    document.title = 'Не найдено · Python-учебник'
  }, [])
  return (
    <main className="page">
      <h1 className="topic-head__title">Такой страницы нет</h1>
      <p>
        <a className="btn btn--primary" href={href({ name: 'home' })}>
          На главную
        </a>
      </p>
    </main>
  )
}
