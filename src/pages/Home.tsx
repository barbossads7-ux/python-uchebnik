import { useEffect } from 'react'
import course, { getTopic } from '../course'
import { ProgressBar } from '../components/ProgressBar'
import { href } from '../router'
import { useProgress, type Progress } from '../storage'
import type { Topic } from '../course/types'

function topicStats(topic: Topic, progress: Progress) {
  const seen = Math.min(progress.slides[topic.n]?.max ?? 0, topic.slides.length)
  const solved = topic.tasks.filter((t) => progress.tasks[t.id]?.solved).length
  return { seen, solved }
}

function ContinueCard({ progress }: { progress: Progress }) {
  const place = progress.lastPlace
  const topic = place ? getTopic(place.topic) : undefined
  if (!place || !topic) {
    const first = course.topics[0]
    return (
      <a className="continue" href={href({ name: 'slides', topic: first.n, slide: 1 })}>
        <span className="continue__eyebrow">Начать</span>
        <span className="continue__title">
          Тема {first.n}. {first.title}
        </span>
        <span className="continue__arrow" aria-hidden="true">→</span>
      </a>
    )
  }
  const slide = Math.min(progress.slides[topic.n]?.last ?? 1, topic.slides.length)
  const where = place.mode === 'tasks' ? 'задания' : `слайд ${slide} из ${topic.slides.length}`
  const to = place.mode === 'tasks' ? href({ name: 'tasks', topic: topic.n }) : href({ name: 'slides', topic: topic.n, slide })
  return (
    <a className="continue" href={to}>
      <span className="continue__eyebrow">Продолжить · {where}</span>
      <span className="continue__title">
        Тема {topic.n}. {topic.title}
      </span>
      <span className="continue__arrow" aria-hidden="true">→</span>
    </a>
  )
}

export function Home() {
  const progress = useProgress()

  useEffect(() => {
    document.title = 'Python-учебник'
  }, [])

  return (
    <main className="page home">
      <header className="home__head">
        <p className="brand">Python-учебник</p>
        <h1 className="home__title">Основы Python по темам</h1>
        {course.introHtml && <div className="home__intro prose" dangerouslySetInnerHTML={{ __html: course.introHtml }} />}
      </header>

      <ContinueCard progress={progress} />

      <ol className="topics" aria-label="Темы">
        {course.topics.map((topic) => {
          const { seen, solved } = topicStats(topic, progress)
          const done = seen === topic.slides.length && solved === topic.tasks.length
          return (
            <li key={topic.n}>
              <a className={done ? 'topic-card topic-card--done' : 'topic-card'} href={href({ name: 'slides', topic: topic.n, slide: null })}>
                <span className="topic-card__num" aria-hidden="true">
                  {done ? '✓' : topic.n}
                </span>
                <span className="topic-card__body">
                  <span className="topic-card__title">
                    <span className="visually-hidden">Тема {topic.n}. </span>
                    {topic.title}
                  </span>
                  <span className="topic-card__meta">
                    Слайды {seen} / {topic.slides.length}
                    {' · '}
                    {topic.tasks.length ? `Задания ${solved} / ${topic.tasks.length}` : 'без заданий'}
                  </span>
                  <ProgressBar value={seen} max={topic.slides.length} label={`Тема ${topic.n}: пройдено слайдов`} />
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      {course.footnoteHtml && <footer className="home__foot prose" dangerouslySetInnerHTML={{ __html: course.footnoteHtml }} />}
    </main>
  )
}
