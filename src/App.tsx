import { Home } from './pages/Home'
import { NotFound, TopicPage } from './pages/Topic'
import { useRoute } from './router'

export function App() {
  const route = useRoute()
  switch (route.name) {
    case 'home':
      return <Home />
    case 'slides':
    case 'tasks':
      return <TopicPage route={route} />
    case 'notFound':
      return <NotFound />
  }
}
