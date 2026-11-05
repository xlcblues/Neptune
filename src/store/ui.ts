import { create } from 'zustand'

export type NavKey = 'home' | 'library' | 'classify' | 'playlist' | 'playing' | 'settings'

interface UiState {
  nav: NavKey
  activePlaylistId: number | null
  setNav: (nav: NavKey) => void
  openPlaylist: (id: number) => void
  clearActivePlaylist: () => void
}

export const useUiStore = create<UiState>((set) => ({
  nav: 'home',
  activePlaylistId: null,
  setNav: (nav) => set({ nav }),
  openPlaylist: (id) => set({ nav: 'playlist', activePlaylistId: id }),
  clearActivePlaylist: () => set({ activePlaylistId: null }),
}))
