import { create } from 'zustand'

export type NavKey = 'home' | 'library' | 'classify' | 'visual'

interface UiState {
  nav: NavKey
  setNav: (nav: NavKey) => void
}

export const useUiStore = create<UiState>((set) => ({
  nav: 'home',
  setNav: (nav) => set({ nav }),
}))
