import { create } from 'zustand'
import type { LibraryStats, ScanProgress, Track } from '../types/track'
import { addFolders as invokeAddFolders, getLibraryStats, listTracks } from '../lib/tauri'

export type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'added'

interface LibraryState {
  tracks: Track[]
  stats: LibraryStats | null
  query: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  page: number
  limit: number
  loading: boolean
  scanning: boolean
  scanProgress: ScanProgress | null
  error: string | null
  setQuery: (query: string) => void
  setSortKey: (key: SortKey) => void
  toggleSortDir: () => void
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  addFolders: (paths: string[]) => Promise<void>
}

function sortValue(key: SortKey, dir: 'asc' | 'desc'): string {
  return `${key}:${dir}`
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  stats: null,
  query: '',
  sortKey: 'title',
  sortDir: 'asc',
  page: 0,
  limit: 2000,
  loading: false,
  scanning: false,
  scanProgress: null,
  error: null,

  setQuery: (query) => {
    set({ query, page: 0 })
    void get().refresh()
  },

  setSortKey: (sortKey) => {
    set({ sortKey, page: 0 })
    void get().refresh()
  },

  toggleSortDir: () => {
    const { sortDir } = get()
    set({ sortDir: sortDir === 'asc' ? 'desc' : 'asc', page: 0 })
    void get().refresh()
  },

  refresh: async () => {
    const { query, sortKey, sortDir, page, limit } = get()
    set({ loading: true, error: null })
    try {
      const [tracks, stats] = await Promise.all([
        listTracks({ query, sort: sortValue(sortKey, sortDir), page, limit }),
        getLibraryStats(),
      ])
      set({ tracks, stats, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  loadMore: async () => {
    const { query, sortKey, sortDir, page, limit, tracks, loading } = get()
    if (loading || tracks.length < limit) return
    set({ loading: true })
    try {
      const next = await listTracks({
        query,
        sort: sortValue(sortKey, sortDir),
        page: page + 1,
        limit,
      })
      if (next.length > 0) {
        set({ tracks: [...tracks, ...next], page: page + 1, loading: false })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  addFolders: async (paths) => {
    if (paths.length === 0) return
    set({ scanning: true, scanProgress: null, error: null })
    try {
      await invokeAddFolders(paths)
    } catch (error) {
      set({
        scanning: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
}))
