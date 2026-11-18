import { create } from 'zustand'
import type { LibraryStats, ScanProgress, Track } from '../types/track'
import { addFolders as invokeAddFolders, getLibraryStats, listTracks } from '../lib/tauri'

export type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'added'

interface LibraryState {
  tracks: Track[]
  stats: LibraryStats | null
  total: number
  query: string
  artistFilter: string | null
  albumFilter: string | null
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
  setArtistFilter: (artist: string | null) => void
  setAlbumFilter: (album: string | null) => void
  clearFilters: () => void
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  addFolders: (paths: string[]) => Promise<void>
}

function sortValue(key: SortKey, dir: 'asc' | 'desc'): string {
  return `${key}:${dir}`
}

function fetchPage(
  query: string,
  sort: string,
  artistFilter: string | null,
  albumFilter: string | null,
  page: number,
  limit: number,
) {
  return listTracks({
    query,
    sort,
    artist: artistFilter ?? undefined,
    album: albumFilter ?? undefined,
    page,
    limit,
  })
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  stats: null,
  total: 0,
  query: '',
  artistFilter: null,
  albumFilter: null,
  sortKey: 'title',
  sortDir: 'asc',
  page: 0,
  limit: 5000,
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

  setArtistFilter: (artist) => {
    set({ artistFilter: artist, albumFilter: null, page: 0 })
    void get().refresh()
  },

  setAlbumFilter: (album) => {
    set({ albumFilter: album, artistFilter: null, page: 0 })
    void get().refresh()
  },

  clearFilters: () => {
    set({ artistFilter: null, albumFilter: null, page: 0 })
    void get().refresh()
  },

  refresh: async () => {
    const { query, sortKey, sortDir, limit, artistFilter, albumFilter } = get()
    set({ loading: true, error: null })
    try {
      const sort = sortValue(sortKey, sortDir)
      const first = await fetchPage(query, sort, artistFilter, albumFilter, 0, limit)
      let tracks = first.tracks
      let nextPage = 1
      while (tracks.length < first.total) {
        const next = await fetchPage(query, sort, artistFilter, albumFilter, nextPage, limit)
        if (next.tracks.length === 0) break
        tracks = [...tracks, ...next.tracks]
        nextPage += 1
      }
      const stats = await getLibraryStats()
      set({ tracks, total: first.total, stats, page: nextPage - 1, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  loadMore: async () => {
    const {
      query,
      sortKey,
      sortDir,
      page,
      limit,
      tracks,
      total,
      loading,
      artistFilter,
      albumFilter,
    } = get()
    if (loading || tracks.length >= total) return
    const nextPage = page + 1
    set({ loading: true })
    try {
      const next = await fetchPage(
        query,
        sortValue(sortKey, sortDir),
        artistFilter,
        albumFilter,
        nextPage,
        limit,
      )
      if (next.tracks.length > 0) {
        set({ tracks: [...tracks, ...next.tracks], total: next.total, page: nextPage, loading: false })
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
