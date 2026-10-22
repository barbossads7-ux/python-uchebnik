// Minimal hash router: #/ · #/topic/N (resume) · #/topic/N/slides/K (K from 1) · #/topic/N/tasks
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'slides'; topic: number; slide: number | null }
  | { name: 'tasks'; topic: number }
  | { name: 'notFound' }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'home' }
  let m = /^\/topic\/(\d+)$/.exec(path)
  if (m) return { name: 'slides', topic: Number(m[1]), slide: null }
  m = /^\/topic\/(\d+)\/slides\/(\d+)$/.exec(path)
  if (m) return { name: 'slides', topic: Number(m[1]), slide: Number(m[2]) }
  m = /^\/topic\/(\d+)\/tasks$/.exec(path)
  if (m) return { name: 'tasks', topic: Number(m[1]) }
  return { name: 'notFound' }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
    case 'notFound':
      return '#/'
    case 'slides':
      return route.slide === null ? `#/topic/${route.topic}` : `#/topic/${route.topic}/slides/${route.slide}`
    case 'tasks':
      return `#/topic/${route.topic}/tasks`
  }
}

export function navigate(route: Route, { replace = false } = {}): void {
  const target = href(route)
  if (replace) {
    history.replaceState(null, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = target
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parseHash(hash)
}
