import { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { HomeView } from './components/HomeView'
import { LibraryView } from './components/LibraryView'
import { ClassifyView } from './components/ClassifyView'
import { PlaceholderView } from './components/PlaceholderView'
import { PlaylistView } from './components/PlaylistView'
import { PlayerBar } from './components/PlayerBar'
import { NowPlayingView } from './components/NowPlayingView'
import { SettingsView } from './components/SettingsView'
import { useUiStore } from './store/ui'
import { useLibraryStore } from './store/library'
import { usePlaylistStore } from './store/playlist'
import { usePlayerStore } from './store/player'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

export default function App() {
  const nav = useUiStore((s) => s.nav)
  const activePlaylistId = useUiStore((s) => s.activePlaylistId)
  const refresh = useLibraryStore((s) => s.refresh)
  const refreshPlaylists = usePlaylistStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
    void refreshPlaylists()
    usePlayerStore.getState().restoreSession()
  }, [refresh, refreshPlaylists])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const player = usePlayerStore.getState()
      switch (event.code) {
        case 'Space':
          event.preventDefault()
          player.togglePlay()
          break
        case 'ArrowLeft':
          event.preventDefault()
          player.seek(player.currentTime - 15)
          break
        case 'ArrowRight':
          event.preventDefault()
          player.seek(player.currentTime + 15)
          break
        case 'MediaPlayPause':
          event.preventDefault()
          player.togglePlay()
          break
        case 'MediaTrackNext':
          event.preventDefault()
          player.next()
          break
        case 'MediaTrackPrevious':
          event.preventDefault()
          player.previous()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="app">
      <TitleBar />
      <div className="layout">
        <Sidebar />
        <main className="main">
          {nav === 'playlist' && activePlaylistId !== null ? (
            <PlaylistView />
          ) : nav === 'home' ? (
            <HomeView />
          ) : nav === 'library' ? (
            <LibraryView />
          ) : nav === 'classify' ? (
            <ClassifyView />
          ) : nav === 'playing' ? (
            <NowPlayingView />
          ) : nav === 'settings' ? (
            <SettingsView />
          ) : (
            <PlaceholderView nav={nav} />
          )}
        </main>
      </div>
      <PlayerBar />
    </div>
  )
}
