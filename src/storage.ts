// Progress in localStorage. Every read/write is guarded: private mode or blocked storage just means no persistence.
import { useSyncExternalStore } from 'react'

const KEY = 'python-uchebnik/progress/v1'

export interface SlideProgress {
  /** Last opened slide, 1-based. */
  last: number
  /** Furthest slide reached, 1-based. */
  max: number
}

export interface TaskProgress {
  code?: string
  /** Text of the «Ввод» field (lines for input()). */
  stdin?: string
  solved?: boolean
}

export interface Progress {
  slides: Record<string, SlideProgress>
  tasks: Record<string, TaskProgress>
  lastPlace?: { topic: number; mode: 'slides' | 'tasks' }
}

const empty = (): Progress => ({ slides: {}, tasks: {} })

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || !isRecord(data.slides) || !isRecord(data.tasks)) return empty()
    return data as unknown as Progress
  } catch {
    return empty()
  }
}

let state = load()
const listeners = new Set<() => void>()

function commit(next: Progress) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable: progress lives only for this tab.
  }
  listeners.forEach((l) => l())
}

window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  state = load()
  listeners.forEach((l) => l())
})

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => state)
}

export function getProgress(): Progress {
  return state
}

export function visitSlide(topic: number, slide: number): void {
  const prev = state.slides[topic]
  const place = state.lastPlace
  if (prev?.last === slide && prev.max >= slide && place?.topic === topic && place.mode === 'slides') return
  commit({
    ...state,
    slides: { ...state.slides, [topic]: { last: slide, max: Math.max(prev?.max ?? 0, slide) } },
    lastPlace: { topic, mode: 'slides' },
  })
}

export function visitTasks(topic: number): void {
  const place = state.lastPlace
  if (place?.topic === topic && place.mode === 'tasks') return
  commit({ ...state, lastPlace: { topic, mode: 'tasks' } })
}

export function saveTaskDraft(id: string, code: string, stdin: string): void {
  const prev = state.tasks[id]
  if (prev?.code === code && (prev.stdin ?? '') === stdin) return
  commit({ ...state, tasks: { ...state.tasks, [id]: { ...prev, code, stdin } } })
}

export function setTaskSolved(id: string, solved: boolean): void {
  const prev = state.tasks[id]
  if (!!prev?.solved === solved) return
  commit({ ...state, tasks: { ...state.tasks, [id]: { ...prev, solved } } })
}
