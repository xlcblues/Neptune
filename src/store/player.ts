import { create } from 'zustand'
import type { Track } from '../types/track'
import { audioEngine, trackSourceUrl } from '../lib/audio'

const VOLUME_KEY = 'neptune.volume'
const PLAY_MODE_KEY = 'neptune.playMode'
const SESSION_KEY = 'neptune.session.v1'

export type PlayMode = 'order' | 'single' | 'shuffle'

interface StoredSession {
  queue: Track[]
  queueIndex: number
  currentTime: number
}

function readVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY)
  if (raw === null) return 0.8
  const stored = Number(raw)
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.8
}

function readPlayMode(): PlayMode {
  const mode = localStorage.getItem(PLAY_MODE_KEY)
  return mode === 'single' || mode === 'shuffle' ? mode : 'order'
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false
  const track = value as Partial<Track>
  return (
    typeof track.id === 'number' &&
    typeof track.path === 'string' &&
    typeof track.title === 'string'
  )
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!Array.isArray(parsed.queue) || parsed.queue.length === 0) return null
    const queue = parsed.queue.filter((item): item is Track => isTrack(item))
    if (queue.length === 0) return null
    const queueIndex = Number(parsed.queueIndex)
    if (!Number.isInteger(queueIndex) || queueIndex < 0 || queueIndex >= queue.length) {
      return null
    }
    return {
      queue,
      queueIndex,
      currentTime: Math.max(0, Number(parsed.currentTime) || 0),
    }
  } catch {
    return null
  }
}

function persistSession(): void {
  const state = usePlayerStore.getState()
  if (state.queue.length === 0 || !state.current) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        queue: state.queue,
        queueIndex: state.queueIndex,
        currentTime: state.currentTime,
      } satisfies StoredSession),
    )
  } catch {
    // Session is best-effort; localStorage quota should not break playback.
  }
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
  persistSession()
  updateMediaSession(track)
  await audioEngine.play(trackSourceUrl(track.path, track.id), track.path)
}

interface PlayerState {
  queue: Track[]
  queueIndex: number
  current: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  playMode: PlayMode
  error: string | null
  playContext: (tracks: Track[], index: number) => Promise<void>
  playTrack: (track: Track, context?: Track[]) => Promise<void>
  restoreSession: () => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setPlayMode: (playMode: PlayMode) => void
  clearError: () => void
}

let sessionRestored = false

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  queueIndex: 0,
  current: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: readVolume(),
  playMode: readPlayMode(),
  error: null,

  playContext: async (tracks, index) => {
    if (tracks.length === 0) return
    await loadTrack(tracks, Math.max(0, Math.min(index, tracks.length - 1)))
  },

  playTrack: async (track, context = [track]) => {
    const index = context.findIndex((item) => item.id === track.id)
    await loadTrack(context, index < 0 ? 0 : index)
  },

  restoreSession: () => {
    if (sessionRestored) return
    sessionRestored = true
    const session = readSession()
    if (!session) return
    const track = session.queue[session.queueIndex]
    if (!track) return
    const duration = track.durationMs > 0 ? track.durationMs / 1000 : 0
    const currentTime = Math.max(0, Math.min(session.currentTime, duration || session.currentTime))
    usePlayerStore.setState({
      queue: session.queue,
      queueIndex: session.queueIndex,
      current: track,
      currentTime,
      duration,
      isPlaying: false,
      error: null,
    })
    updateMediaSession(track)
    void audioEngine.load(trackSourceUrl(track.path, track.id), track.path, currentTime)
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
    const { queue, queueIndex, playMode } = get()
    if (queue.length === 0) return
    if (playMode === 'shuffle') {
      if (queue.length > 1) {
        let nextIndex = queueIndex
        while (nextIndex === queueIndex) {
          nextIndex = Math.floor(Math.random() * queue.length)
        }
        void loadTrack(queue, nextIndex)
      }
      return
    }
    if (playMode === 'order' && queueIndex >= queue.length - 1) {
      audioEngine.seek(0)
      audioEngine.pause()
      set({ isPlaying: false, currentTime: 0 })
      persistSession()
      return
    }
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
    persistSession()
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume))
    audioEngine.setVolume(clamped)
    localStorage.setItem(VOLUME_KEY, String(clamped))
    set({ volume: clamped })
  },

  setPlayMode: (playMode) => {
    localStorage.setItem(PLAY_MODE_KEY, playMode)
    set({ playMode })
  },

  clearError: () => set({ error: null }),
}))

audioEngine.setVolume(usePlayerStore.getState().volume)

let lastPersistAt = 0

audioEngine.subscribe((event) => {
  const state = usePlayerStore.getState()
  switch (event.type) {
    case 'play':
      usePlayerStore.setState({ isPlaying: true, error: null })
      persistSession()
      lastPersistAt = Date.now()
      break
    case 'pause':
      usePlayerStore.setState({ isPlaying: false })
      persistSession()
      break
    case 'time':
      usePlayerStore.setState({
        currentTime: event.currentTime,
        duration: event.duration,
      })
      if (Date.now() - lastPersistAt > 2000) {
        persistSession()
        lastPersistAt = Date.now()
      }
      break
    case 'duration':
      usePlayerStore.setState({ duration: event.duration })
      break
    case 'ended':
      if (state.playMode === 'single') {
        audioEngine.seek(0)
        void audioEngine.resume()
      } else {
        state.next()
      }
      break
    case 'error':
      usePlayerStore.setState({ error: event.message, isPlaying: false })
      persistSession()
      break
  }
})

window.addEventListener('beforeunload', () => persistSession())
window.addEventListener('pagehide', () => persistSession())
