import { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { HomeView } from './components/HomeView'
import { LibraryView } from './components/LibraryView'
import { PlaceholderView } from './components/PlaceholderView'
import { useUiStore } from './store/ui'
import { useLibraryStore } from './store/library'

export default function App() {
  const nav = useUiStore((s) => s.nav)
  const refresh = useLibraryStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="app">
      <TitleBar />
      <div className="layout">
        <Sidebar />
        <main className="main">
          {nav === 'home' ? (
            <HomeView />
          ) : nav === 'library' ? (
            <LibraryView />
          ) : (
            <PlaceholderView nav={nav} />
          )}
        </main>
      </div>
    </div>
  )
}
