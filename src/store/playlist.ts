import { create } from 'zustand'
import type { Playlist, PlaylistDetail } from '../types/track'
import {
  addTracksToPlaylist as invokeAddTracksToPlaylist,
  createPlaylist as invokeCreatePlaylist,
  createSmartPlaylist as invokeCreateSmartPlaylist,
  deletePlaylist as invokeDeletePlaylist,
  getPlaylistDetail,
  listPlaylists,
  removeTracksFromPlaylist as invokeRemoveTracksFromPlaylist,
  reorderPlaylist as invokeReorderPlaylist,
  setTrackCover as invokeSetTrackCover,
  updatePlaylist as invokeUpdatePlaylist,
  updatePlaylistCover as invokeUpdatePlaylistCover,
  updateTrackMetadata as invokeUpdateTrackMetadata,
} from '../lib/tauri'
import { useLibraryStore } from './library'

export interface PlaylistPatch {
  name?: string
  description?: string | null
}

export interface SmartPlaylistInput {
  name: string
  description: string | null
  genre: string
  yearStart: number | null
  yearEnd: number | null
  minDurationMs: number | null
  maxDurationMs: number | null
}

interface PlaylistState {
  playlists: Playlist[]
  active: PlaylistDetail | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  open: (id: number) => Promise<void>
  create: (name: string, description?: string | null) => Promise<Playlist | null>
  update: (id: number, patch: PlaylistPatch) => Promise<void>
  updateCover: (id: number, coverPath: string | null) => Promise<void>
  remove: (id: number) => Promise<void>
  addTracks: (id: number, trackIds: number[]) => Promise<void>
  removeTracks: (id: number, trackIds: number[]) => Promise<void>
  reorder: (id: number, orderedIds: number[]) => Promise<void>
  createSmart: (input: SmartPlaylistInput) => Promise<PlaylistDetail | null>
  updateTrack: (
    id: number,
    patch: { title: string; artist: string; album: string; genre: string },
  ) => Promise<void>
  setTrackCover: (id: number, coverPath: string | null) => Promise<void>
}

async function refreshActiveDetail(state: PlaylistState): Promise<void> {
  const active = state.active
  if (!active) return
  const detail = await getPlaylistDetail(active.playlist.id)
  if (detail) {
    usePlaylistStore.setState({ active: detail })
  }
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  active: null,
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const playlists = await listPlaylists()
      set({ playlists, loading: false })
      await refreshActiveDetail(get())
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  open: async (id) => {
    set({ loading: true, error: null })
    try {
      const detail = await getPlaylistDetail(id)
      set({ active: detail, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  create: async (name, description = null) => {
    try {
      const playlist = await invokeCreatePlaylist(name, description)
      set({ playlists: [playlist, ...get().playlists] })
      return playlist
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },

  update: async (id, patch) => {
    try {
      const updated = await invokeUpdatePlaylist(id, patch)
      set({
        playlists: get().playlists.map((playlist) =>
          playlist.id === id ? updated : playlist,
        ),
      })
      await refreshActiveDetail(get())
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  updateCover: async (id, coverPath) => {
    try {
      const updated = await invokeUpdatePlaylistCover(id, coverPath)
      set({
        playlists: get().playlists.map((playlist) =>
          playlist.id === id ? updated : playlist,
        ),
      })
      await refreshActiveDetail(get())
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  remove: async (id) => {
    try {
      await invokeDeletePlaylist(id)
      set({
        playlists: get().playlists.filter((playlist) => playlist.id !== id),
        active: get().active?.playlist.id === id ? null : get().active,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  addTracks: async (id, trackIds) => {
    if (trackIds.length === 0) return
    try {
      await invokeAddTracksToPlaylist(id, trackIds)
      await get().refresh()
      if (get().active?.playlist.id === id) {
        await get().open(id)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  removeTracks: async (id, trackIds) => {
    if (trackIds.length === 0) return
    try {
      await invokeRemoveTracksFromPlaylist(id, trackIds)
      await get().refresh()
      if (get().active?.playlist.id === id) {
        await get().open(id)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  reorder: async (id, orderedIds) => {
    if (orderedIds.length < 2) return
    try {
      await invokeReorderPlaylist(id, orderedIds)
      await get().refresh()
      if (get().active?.playlist.id === id) {
        await get().open(id)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  createSmart: async (input) => {
    try {
      const detail = await invokeCreateSmartPlaylist(input.name, input.description, {
        genre: input.genre,
        yearStart: input.yearStart,
        yearEnd: input.yearEnd,
        minDurationMs: input.minDurationMs,
        maxDurationMs: input.maxDurationMs,
      })
      set({
        playlists: [detail.playlist, ...get().playlists],
        active: detail,
      })
      return detail
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },

  updateTrack: async (id, patch) => {
    try {
      await invokeUpdateTrackMetadata(id, patch)
      await refreshActiveDetail(get())
      void useLibraryStore.getState().refresh()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  setTrackCover: async (id, coverPath) => {
    try {
      await invokeSetTrackCover(id, coverPath)
      await refreshActiveDetail(get())
      void useLibraryStore.getState().refresh()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },
}))
