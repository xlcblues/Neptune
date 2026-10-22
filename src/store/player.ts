import { create } from 'zustand'
import type { Track } from '../types/track'
import { audioEngine, trackSourceUrl } from '../lib/audio'

const VOLUME_KEY = 'neptune.volume'

function readVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY)
  if (raw === null) return 0.8
  const stored = Number(raw)
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.8
}

function updateMediaSession(track: Track | null): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  try {
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || '未知艺人',
      album: track.album || '',
    })
    const player = usePlayerStore.getState()
    navigator.mediaSession.setActionHandler('play', () => void player.togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => void player.togglePlay())
    navigator.mediaSession.setActionHandler('previoustrack', () => player.previous())
    navigator.mediaSession.setActionHandler('nexttrack', () => player.next())
  } catch {
    // Media Session is optional; ignore unsupported browsers.
  }
}

async function loadTrack(queue: Track[], index: number): Promise<void> {
  const track = queue[index]
  if (!track) return
  usePlayerStore.setState({
    queue,
    queueIndex: index,
    current: track,
    currentTime: 0,
    duration: track.durationMs / 1000,
    error: null,
  })
  updateMediaSession(track)
  await audioEngine.play(trackSourceUrl(track.path, track.id))
}

interface PlayerState {
  queue: Track[]
  queueIndex: number
  current: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  error: string | null
  playContext: (tracks: Track[], index: number) => Promise<void>
  playTrack: (track: Track, context?: Track[]) => Promise<void>
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  clearError: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  queueIndex: 0,
  current: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: readVolume(),
  error: null,

  playContext: async (tracks, index) => {
    if (tracks.length === 0) return
    await loadTrack(tracks, Math.max(0, Math.min(index, tracks.length - 1)))
  },

  playTrack: async (track, context = [track]) => {
    const index = context.findIndex((item) => item.id === track.id)
    await loadTrack(context, index < 0 ? 0 : index)
  },

  togglePlay: () => {
    const { current, isPlaying } = get()
    if (!current) return
    if (isPlaying) {
      audioEngine.pause()
    } else {
      void audioEngine.resume()
    }
  },

  next: () => {
    const { queue, queueIndex } = get()
    if (queue.length === 0) return
    const nextIndex = (queueIndex + 1) % queue.length
    void loadTrack(queue, nextIndex)
  },

  previous: () => {
    const { queue, queueIndex, currentTime } = get()
    if (queue.length === 0) return
    if (currentTime > 3) {
      audioEngine.seek(0)
      set({ currentTime: 0 })
      return
    }
    const previousIndex = (queueIndex - 1 + queue.length) % queue.length
    void loadTrack(queue, previousIndex)
  },

  seek: (time) => {
    const { duration } = get()
    const clamped = Math.min(duration || 0, Math.max(0, time))
    audioEngine.seek(clamped)
    set({ currentTime: clamped })
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume))
    audioEngine.setVolume(clamped)
    localStorage.setItem(VOLUME_KEY, String(clamped))
    set({ volume: clamped })
  },

  clearError: () => set({ error: null }),
}))

audioEngine.setVolume(usePlayerStore.getState().volume)

audioEngine.subscribe((event) => {
  const state = usePlayerStore.getState()
  switch (event.type) {
    case 'play':
      usePlayerStore.setState({ isPlaying: true, error: null })
      break
    case 'pause':
      usePlayerStore.setState({ isPlaying: false })
      break
    case 'time':
      usePlayerStore.setState({
        currentTime: event.currentTime,
        duration: event.duration,
      })
      break
    case 'duration':
      usePlayerStore.setState({ duration: event.duration })
      break
    case 'ended':
      state.next()
      break
    case 'error':
      usePlayerStore.setState({ error: event.message, isPlaying: false })
      break
  }
})
