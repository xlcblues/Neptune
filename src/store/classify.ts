import { create } from 'zustand'
import type {
  ClassificationItem,
  ClassifyProgress,
  ClassifyStats,
} from '../types/track'
import {
  applyGenre as invokeApplyGenre,
  applyGenresBatch as invokeApplyGenresBatch,
  classifyAll as invokeClassifyAll,
  classifyBatch as invokeClassifyBatch,
  getClassifyStats,
  listClassifications,
} from '../lib/tauri'

export type ClassifyFilter = 'all' | 'pending' | 'unclassified' | 'classified'

interface ClassifyState {
  items: ClassificationItem[]
  stats: ClassifyStats | null
  filter: ClassifyFilter
  page: number
  limit: number
  loading: boolean
  running: boolean
  useNetwork: boolean
  progress: ClassifyProgress | null
  error: string | null
  selectedIds: number[]
  setFilter: (filter: ClassifyFilter) => void
  setUseNetwork: (useNetwork: boolean) => void
  toggleSelect: (id: number) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  refresh: () => Promise<void>
  startAll: () => Promise<void>
  startPending: () => Promise<void>
  retrySelected: () => Promise<void>
  applySuggestion: (id: number, genre: string) => Promise<void>
  applySelectedSuggestions: () => Promise<void>
  applyBatch: (genre: string) => Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useClassifyStore = create<ClassifyState>((set, get) => ({
  items: [],
  stats: null,
  filter: 'all',
  page: 0,
  limit: 500,
  loading: false,
  running: false,
  useNetwork: false,
  progress: null,
  error: null,
  selectedIds: [],

  setFilter: (filter) => {
    set({ filter, page: 0, selectedIds: [] })
    void get().refresh()
  },

  setUseNetwork: (useNetwork) => set({ useNetwork }),

  toggleSelect: (id) => {
    const { selectedIds } = get()
    set({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    })
  },

  toggleSelectAll: () => {
    const { items, selectedIds } = get()
    const ids = items.map((item) => item.id)
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id))
    set({
      selectedIds: allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids])),
    })
  },

  clearSelection: () => set({ selectedIds: [] }),

  refresh: async () => {
    const { filter, page, limit } = get()
    set({ loading: true, error: null })
    try {
      const [result, stats] = await Promise.all([
        listClassifications(filter === 'all' ? null : filter, page, limit),
        getClassifyStats(),
      ])
      set({ items: result.items, stats, loading: false })
    } catch (error) {
      set({ loading: false, error: errorMessage(error) })
    }
  },

  startAll: async () => {
    const { running, useNetwork } = get()
    if (running) return
    set({ running: true, progress: null, error: null })
    try {
      await invokeClassifyAll(useNetwork)
    } catch (error) {
      set({ running: false, error: errorMessage(error) })
    }
  },

  startPending: async () => {
    const { running, useNetwork, items } = get()
    if (running) return
    const ids = items.filter((item) => item.status === 'pending').map((item) => item.id)
    if (ids.length === 0) return
    set({ running: true, progress: null, error: null })
    try {
      await invokeClassifyBatch(ids, useNetwork)
    } catch (error) {
      set({ running: false, error: errorMessage(error) })
    }
  },

  retrySelected: async () => {
    const { running, useNetwork, selectedIds } = get()
    if (running || selectedIds.length === 0) return
    set({ running: true, progress: null, error: null })
    try {
      await invokeClassifyBatch(selectedIds, useNetwork)
    } catch (error) {
      set({ running: false, error: errorMessage(error) })
    }
  },

  applySuggestion: async (id, genre) => {
    try {
      await invokeApplyGenre(id, genre)
      await get().refresh()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  applySelectedSuggestions: async () => {
    const { items, selectedIds } = get()
    const targets = items.filter(
      (item) => selectedIds.includes(item.id) && item.suggestedGenre,
    )
    if (targets.length === 0) return
    try {
      for (const item of targets) {
        await invokeApplyGenre(item.id, item.suggestedGenre as string)
      }
      set({ selectedIds: [] })
      await get().refresh()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  applyBatch: async (genre) => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return
    try {
      await invokeApplyGenresBatch(selectedIds, genre)
      set({ selectedIds: [] })
      await get().refresh()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
}))
