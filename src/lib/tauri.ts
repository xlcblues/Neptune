import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import type {
  ClassificationItem,
  ClassificationPage,
  ClassifyProgress,
  ClassifyStats,
  LibraryStats,
  Playlist,
  PlaylistDetail,
  ScanProgress,
  SmartPlaylistCriteria,
  Track,
} from '../types/track'

export { convertFileSrc }

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function coverUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (!isTauriRuntime()) return path.startsWith('data:') ? path : ''
  return convertFileSrc(path)
}

export async function pickFolders(): Promise<string[]> {
  if (!isTauriRuntime()) return []
  const selected = await open({ directory: true, multiple: true })
  if (!selected) return []
  return Array.isArray(selected) ? selected : [selected]
}

export async function pickImage(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        const reader = new FileReader()
        reader.onload = () =>
          resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      }
      input.click()
    })
  }
  const selected = await open({
    multiple: false,
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  return selected ? String(selected) : null
}

export async function addFolders(paths: string[]): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('add_folders', { paths })
}

export async function ensureAudioAccess(path: string): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('ensure_audio_access', { path })
}

export interface ListTracksOptions {
  query?: string
  sort?: string
  page?: number
  limit?: number
}

export async function listTracks(options: ListTracksOptions = {}): Promise<Track[]> {
  if (!isTauriRuntime()) return filterMockTracks(options)
  return invoke<Track[]>('list_tracks', {
    query: options.query?.trim() || null,
    sort: options.sort || null,
    page: options.page ?? 0,
    limit: options.limit ?? 2000,
  })
}

export async function getLibraryStats(): Promise<LibraryStats> {
  if (!isTauriRuntime()) return mockStats
  return invoke<LibraryStats>('get_library_stats')
}

export async function onScanProgress(
  handler: (progress: ScanProgress) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {}
  const unlisten = await listen<ScanProgress>('scan_progress', (event) => handler(event.payload))
  return unlisten
}

export async function listPlaylists(): Promise<Playlist[]> {
  if (!isTauriRuntime()) return [...mockPlaylists]
  return invoke<Playlist[]>('list_playlists')
}

export async function createPlaylist(
  name: string,
  description: string | null = null,
): Promise<Playlist> {
  if (!isTauriRuntime()) return mockCreatePlaylist(name, description)
  return invoke<Playlist>('create_playlist', { name, description })
}

export async function updatePlaylist(
  id: number,
  patch: { name?: string; description?: string | null },
): Promise<Playlist> {
  if (!isTauriRuntime()) return mockUpdatePlaylist(id, patch)
  return invoke<Playlist>('update_playlist', {
    id,
    name: patch.name ?? null,
    description: patch.description === undefined ? null : patch.description ?? '',
  })
}

export async function updatePlaylistCover(
  id: number,
  coverPath: string | null,
): Promise<Playlist> {
  if (!isTauriRuntime()) return mockUpdatePlaylistCover(id, coverPath)
  return invoke<Playlist>('update_playlist_cover', { id, coverPath })
}

export async function deletePlaylist(id: number): Promise<void> {
  if (!isTauriRuntime()) {
    mockDeletePlaylist(id)
    return
  }
  await invoke('delete_playlist', { id })
}

export async function getPlaylistDetail(id: number): Promise<PlaylistDetail | null> {
  if (!isTauriRuntime()) return mockGetPlaylistDetail(id)
  return invoke<PlaylistDetail | null>('get_playlist_detail', { id })
}

export async function addTracksToPlaylist(id: number, trackIds: number[]): Promise<number> {
  if (!isTauriRuntime()) return mockAddTracksToPlaylist(id, trackIds)
  return invoke<number>('add_tracks_to_playlist', { id, trackIds })
}

export async function removeTracksFromPlaylist(id: number, trackIds: number[]): Promise<number> {
  if (!isTauriRuntime()) return mockRemoveTracksFromPlaylist(id, trackIds)
  return invoke<number>('remove_tracks_from_playlist', { id, trackIds })
}

export async function reorderPlaylist(id: number, orderedIds: number[]): Promise<void> {
  if (!isTauriRuntime()) {
    mockReorderPlaylist(id, orderedIds)
    return
  }
  await invoke('reorder_playlist', { id, orderedIds })
}

export async function previewSmartPlaylist(
  criteria: SmartPlaylistCriteria,
): Promise<Track[]> {
  if (!isTauriRuntime()) return mockSmartPlaylistTracks(criteria)
  return invoke<Track[]>('preview_smart_playlist', {
    genre: criteria.genre || null,
    yearStart: criteria.yearStart,
    yearEnd: criteria.yearEnd,
    minDurationMs: criteria.minDurationMs,
    maxDurationMs: criteria.maxDurationMs,
  })
}

export async function createSmartPlaylist(
  name: string,
  description: string | null,
  criteria: SmartPlaylistCriteria,
): Promise<PlaylistDetail> {
  if (!isTauriRuntime()) return mockCreateSmartPlaylist(name, description, criteria)
  return invoke<PlaylistDetail>('create_smart_playlist', {
    name,
    description,
    genre: criteria.genre || null,
    yearStart: criteria.yearStart,
    yearEnd: criteria.yearEnd,
    minDurationMs: criteria.minDurationMs,
    maxDurationMs: criteria.maxDurationMs,
  })
}

export async function updateTrackMetadata(
  id: number,
  patch: { title: string; artist: string; album: string; genre: string },
): Promise<void> {
  if (!isTauriRuntime()) {
    const track = mockTracks.find((entry) => entry.id === id)
    if (track) {
      track.title = patch.title
      track.artist = patch.artist
      track.album = patch.album
      track.genre = patch.genre
      track.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    }
    return
  }
  await invoke('update_track_metadata', { id, ...patch })
}

export async function setTrackCover(id: number, coverPath: string | null): Promise<void> {
  if (!isTauriRuntime()) {
    const track = mockTracks.find((entry) => entry.id === id)
    if (track) track.coverPath = coverPath
    return
  }
  await invoke('set_track_cover', { id, coverPath })
}

export async function listClassifications(
  status: string | null,
  page = 0,
  limit = 500,
): Promise<ClassificationPage> {
  if (!isTauriRuntime()) return mockClassificationPage(status, page, limit)
  return invoke<ClassificationPage>('list_classifications', { status, page, limit })
}

export async function getClassifyStats(): Promise<ClassifyStats> {
  if (!isTauriRuntime()) return mockClassifyStats()
  return invoke<ClassifyStats>('get_classify_stats')
}

export async function applyGenre(trackId: number, genre: string): Promise<void> {
  if (!isTauriRuntime()) {
    const item = mockClassifications.find((entry) => entry.id === trackId)
    if (item) {
      item.currentGenre = genre
      item.suggestedGenre = genre
      item.source = 'manual'
      item.confidence = 1
      item.status = 'classified'
    }
    return
  }
  await invoke('apply_genre', { trackId, genre })
}

export async function applyGenresBatch(ids: number[], genre: string): Promise<number> {
  if (!isTauriRuntime()) {
    let applied = 0
    for (const item of mockClassifications) {
      if (ids.includes(item.id)) {
        item.currentGenre = genre
        item.suggestedGenre = genre
        item.source = 'manual'
        item.confidence = 1
        item.status = 'classified'
        applied += 1
      }
    }
    return applied
  }
  return invoke<number>('apply_genres_batch', { ids, genre })
}

export async function classifyAll(useNetwork: boolean): Promise<void> {
  if (!isTauriRuntime()) {
    runMockClassify(useNetwork)
    return
  }
  await invoke('classify_all', { useNetwork })
}

export async function classifyBatch(ids: number[], useNetwork: boolean): Promise<void> {
  if (!isTauriRuntime()) {
    runMockClassify(useNetwork, ids)
    return
  }
  await invoke('classify_batch', { ids, useNetwork })
}

export async function onClassifyProgress(
  handler: (progress: ClassifyProgress) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    mockProgressHandler = handler
    return () => {
      if (mockProgressHandler === handler) mockProgressHandler = null
    }
  }
  const unlisten = await listen<ClassifyProgress>('classify_progress', (event) =>
    handler(event.payload),
  )
  return unlisten
}

const mockClassifications: ClassificationItem[] = [
  {
    id: 1,
    title: '潮汐',
    artist: '深海电台',
    album: '蓝色时刻',
    currentGenre: '电子',
    suggestedGenre: '电子',
    confidence: 0.95,
    source: 'metadata',
    status: 'classified',
  },
  {
    id: 2,
    title: '夜航',
    artist: 'Echo Parade',
    album: 'City Lights',
    currentGenre: '',
    suggestedGenre: '爵士',
    confidence: 0.9,
    source: 'network',
    status: 'pending',
  },
  {
    id: 3,
    title: '慢板',
    artist: '林晚',
    album: '一席之地',
    currentGenre: '古典',
    suggestedGenre: '独立',
    confidence: 0.72,
    source: 'local',
    status: 'pending',
  },
  {
    id: 4,
    title: '街角咖啡',
    artist: 'Miles Quartet',
    album: 'Sunday Sessions',
    currentGenre: '爵士',
    suggestedGenre: '爵士',
    confidence: 0.95,
    source: 'metadata',
    status: 'classified',
  },
  {
    id: 5,
    title: '雾中灯塔',
    artist: '北屿',
    album: '海岸线',
    currentGenre: '',
    suggestedGenre: null,
    confidence: null,
    source: null,
    status: 'unclassified',
  },
  {
    id: 6,
    title: '麦田',
    artist: '乔木与溪',
    album: '四季来信',
    currentGenre: '民谣',
    suggestedGenre: '民谣',
    confidence: 0.95,
    source: 'metadata',
    status: 'classified',
  },
  {
    id: 7,
    title: '心跳频率',
    artist: 'Pulse Lab',
    album: 'Neon Garden',
    currentGenre: '',
    suggestedGenre: null,
    confidence: null,
    source: null,
    status: 'unclassified',
  },
  {
    id: 8,
    title: '午后',
    artist: '安叙',
    album: '小事集',
    currentGenre: '',
    suggestedGenre: '轻音乐',
    confidence: 0.8,
    source: 'local',
    status: 'pending',
  },
  {
    id: 9,
    title: '极光之后',
    artist: 'Aurora Waves',
    album: 'Northern Bloom',
    currentGenre: '氛围',
    suggestedGenre: '氛围',
    confidence: 0.95,
    source: 'metadata',
    status: 'classified',
  },
  {
    id: 10,
    title: '城市的雨',
    artist: '陈澈',
    album: '夜行手记',
    currentGenre: '',
    suggestedGenre: null,
    confidence: null,
    source: null,
    status: 'unclassified',
  },
]

let mockProgressHandler: ((progress: ClassifyProgress) => void) | null = null
let mockClassifyRunning = false

function mockClassifyStats(): ClassifyStats {
  const sourceCounts: Record<string, number> = {
    metadata: 0,
    local: 0,
    network: 0,
    manual: 0,
  }
  for (const item of mockClassifications) {
    if (item.source && sourceCounts[item.source] !== undefined) {
      sourceCounts[item.source] += 1
    }
  }
  return {
    total: mockClassifications.length,
    classified: mockClassifications.filter((item) => item.status === 'classified').length,
    pending: mockClassifications.filter((item) => item.status === 'pending').length,
    unclassified: mockClassifications.filter((item) => item.status === 'unclassified').length,
    sourceCounts,
  }
}

function mockClassificationPage(
  status: string | null,
  page: number,
  limit: number,
): ClassificationPage {
  const filtered = status
    ? mockClassifications.filter((item) => item.status === status)
    : mockClassifications
  const start = page * limit
  return {
    items: filtered.slice(start, start + limit),
    stats: mockClassifyStats(),
  }
}

function runMockClassify(useNetwork: boolean, ids?: number[]) {
  if (mockClassifyRunning) return
  const targets =
    ids && ids.length > 0
      ? mockClassifications.filter((item) => ids.includes(item.id))
      : mockClassifications
  const total = targets.length
  if (total === 0) {
    mockProgressHandler?.({
      total: 0,
      current: 0,
      found: 0,
      status: 'done',
      message: '没有需要分类的曲目',
    })
    return
  }

  mockClassifyRunning = true
  const suggestions = ['电子', '氛围', '爵士', '摇滚', '独立', '民谣', '古典', '蓝调']
  const emit = (current: number, found: number, status: string, message: string) => {
    mockProgressHandler?.({ total, current, found, status, message })
  }
  emit(0, 0, 'running', '开始分类')

  let index = 0
  let found = 0
  const interval = window.setInterval(() => {
    index += 1
    const item = targets[index - 1]
    if (item && (!item.currentGenre || !item.suggestedGenre)) {
      const genre = suggestions[index % suggestions.length]
      const fromNetwork = useNetwork && index % 3 === 0
      item.suggestedGenre = genre
      item.source = fromNetwork ? 'network' : 'local'
      item.confidence = fromNetwork ? 0.9 : 0.82
      item.status = 'pending'
      found += 1
    }
    emit(index, found, 'running', `已完成 ${index}/${total} 首`)
    if (index >= total) {
      window.clearInterval(interval)
      mockClassifyRunning = false
      emit(total, found, 'done', `分类完成，共 ${found} 首获得流派建议`)
    }
  }, 140)
}

const mockTracks: Track[] = [
  {
    id: 1,
    path: 'D:\\Music\\Neptune Demo\\01 潮汐.wav',
    title: '潮汐',
    artist: '深海电台',
    album: '蓝色时刻',
    genre: '电子',
    durationMs: 254000,
    bitrate: null,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 28160512,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2024,
  },
  {
    id: 2,
    path: 'D:\\Music\\Neptune Demo\\02 夜航.mp3',
    title: '夜航',
    artist: 'Echo Parade',
    album: 'City Lights',
    genre: '摇滚',
    durationMs: 221000,
    bitrate: 320000,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 8847360,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2022,
  },
  {
    id: 3,
    path: 'D:\\Music\\Neptune Demo\\03 慢板.flac',
    title: '慢板',
    artist: '林晚',
    album: '一席之地',
    genre: '古典',
    durationMs: 402000,
    bitrate: 920000,
    sampleRate: 96000,
    channels: 2,
    coverPath: null,
    sizeBytes: 46137344,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2019,
  },
  {
    id: 4,
    path: 'D:\\Music\\Neptune Demo\\04 街角咖啡.mp3',
    title: '街角咖啡',
    artist: 'Miles Quartet',
    album: 'Sunday Sessions',
    genre: '爵士',
    durationMs: 318000,
    bitrate: 256000,
    sampleRate: 48000,
    channels: 2,
    coverPath: null,
    sizeBytes: 10158080,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2021,
  },
  {
    id: 5,
    path: 'D:\\Music\\Neptune Demo\\05 雾中灯塔.ogg',
    title: '雾中灯塔',
    artist: '北屿',
    album: '海岸线',
    genre: '氛围',
    durationMs: 286000,
    bitrate: 192000,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 6860800,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2023,
  },
  {
    id: 6,
    path: 'D:\\Music\\Neptune Demo\\06 麦田.mp3',
    title: '麦田',
    artist: '乔木与溪',
    album: '四季来信',
    genre: '民谣',
    durationMs: 245000,
    bitrate: 320000,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 9830400,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2018,
  },
  {
    id: 7,
    path: 'D:\\Music\\Neptune Demo\\07 心跳频率.mp3',
    title: '心跳频率',
    artist: 'Pulse Lab',
    album: 'Neon Garden',
    genre: '电子',
    durationMs: 198000,
    bitrate: 320000,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 7925760,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2025,
  },
  {
    id: 8,
    path: 'D:\\Music\\Neptune Demo\\08 午后.m4a',
    title: '午后',
    artist: '安叙',
    album: '小事集',
    genre: '民谣',
    durationMs: 233000,
    bitrate: 256000,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 7456000,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2020,
  },
  {
    id: 9,
    path: 'D:\\Music\\Neptune Demo\\09 极光之后.mp3',
    title: '极光之后',
    artist: 'Aurora Waves',
    album: 'Northern Bloom',
    genre: '氛围',
    durationMs: 372000,
    bitrate: 320000,
    sampleRate: 48000,
    channels: 2,
    coverPath: null,
    sizeBytes: 14880000,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2024,
  },
  {
    id: 10,
    path: 'D:\\Music\\Neptune Demo\\10 城市的雨.mp3',
    title: '城市的雨',
    artist: '陈澈',
    album: '夜行手记',
    genre: '摇滚',
    durationMs: 267000,
    bitrate: 320000,
    sampleRate: 44100,
    channels: 2,
    coverPath: null,
    sizeBytes: 10680000,
    addedAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    year: 2022,
  },
]

const mockStats: LibraryStats = {
  trackCount: mockTracks.length,
  folderCount: 2,
  totalDurationMs: mockTracks.reduce((sum, track) => sum + track.durationMs, 0),
  totalSizeBytes: mockTracks.reduce((sum, track) => sum + track.sizeBytes, 0),
  lastScannedAt: '2026-10-21 18:02:11',
}

const mockPlaylists: Playlist[] = [
  {
    id: 1,
    name: '深夜通勤',
    description: '夜路、车窗与城市的低语',
    coverPath: null,
    createdAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    isSmart: false,
    trackCount: 6,
    totalDurationMs: 1516000,
  },
  {
    id: 2,
    name: '周末阅读',
    description: '安静翻阅时的背景音乐',
    coverPath: null,
    createdAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    isSmart: false,
    trackCount: 4,
    totalDurationMs: 1188000,
  },
  {
    id: 3,
    name: '我的收藏',
    description: null,
    coverPath: null,
    createdAt: '2026-10-21 18:02:11',
    updatedAt: '2026-10-21 18:02:11',
    isSmart: false,
    trackCount: 5,
    totalDurationMs: 1252000,
  },
]

const mockPlaylistTrackIds: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6],
  2: [3, 4, 9, 10],
  3: [1, 2, 4, 7, 9],
}

let mockPlaylistSeq = 3

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function syncMockPlaylistCounts(): void {
  for (const playlist of mockPlaylists) {
    const ids = mockPlaylistTrackIds[playlist.id] ?? []
    playlist.trackCount = ids.length
    playlist.totalDurationMs = ids.reduce(
      (sum, trackId) => sum + (mockTracks.find((track) => track.id === trackId)?.durationMs ?? 0),
      0,
    )
  }
}

function mockPlaylistById(id: number): Playlist | undefined {
  return mockPlaylists.find((playlist) => playlist.id === id)
}

function mockCreatePlaylist(name: string, description: string | null): Playlist {
  const now = nowStamp()
  const playlist: Playlist = {
    id: ++mockPlaylistSeq,
    name: name || '新歌单',
    description,
    coverPath: null,
    createdAt: now,
    updatedAt: now,
    isSmart: false,
    trackCount: 0,
    totalDurationMs: 0,
  }
  mockPlaylists.unshift(playlist)
  mockPlaylistTrackIds[playlist.id] = []
  return playlist
}

function mockUpdatePlaylist(
  id: number,
  patch: { name?: string; description?: string | null },
): Playlist {
  const playlist = mockPlaylistById(id)
  if (!playlist) throw new Error('歌单不存在')
  if (patch.name !== undefined) playlist.name = patch.name
  if (patch.description !== undefined) playlist.description = patch.description
  playlist.updatedAt = nowStamp()
  return playlist
}

function mockUpdatePlaylistCover(id: number, coverPath: string | null): Playlist {
  const playlist = mockPlaylistById(id)
  if (!playlist) throw new Error('歌单不存在')
  playlist.coverPath = coverPath
  playlist.updatedAt = nowStamp()
  return playlist
}

function mockDeletePlaylist(id: number): void {
  const index = mockPlaylists.findIndex((playlist) => playlist.id === id)
  if (index >= 0) mockPlaylists.splice(index, 1)
  delete mockPlaylistTrackIds[id]
}

function mockGetPlaylistDetail(id: number): PlaylistDetail | null {
  const playlist = mockPlaylistById(id)
  if (!playlist) return null
  const ids = mockPlaylistTrackIds[id] ?? []
  return {
    playlist: { ...playlist },
    tracks: ids
      .map((trackId) => mockTracks.find((track) => track.id === trackId))
      .filter((track): track is Track => Boolean(track)),
  }
}

function mockAddTracksToPlaylist(id: number, trackIds: number[]): number {
  const existing = mockPlaylistTrackIds[id] ?? []
  const added = trackIds.filter((trackId) => !existing.includes(trackId))
  mockPlaylistTrackIds[id] = [...existing, ...added]
  const playlist = mockPlaylistById(id)
  if (playlist) playlist.updatedAt = nowStamp()
  syncMockPlaylistCounts()
  return added.length
}

function mockRemoveTracksFromPlaylist(id: number, trackIds: number[]): number {
  const existing = mockPlaylistTrackIds[id] ?? []
  const next = existing.filter((trackId) => !trackIds.includes(trackId))
  const removed = existing.length - next.length
  mockPlaylistTrackIds[id] = next
  const playlist = mockPlaylistById(id)
  if (playlist) playlist.updatedAt = nowStamp()
  syncMockPlaylistCounts()
  return removed
}

function mockReorderPlaylist(id: number, orderedIds: number[]): void {
  const existing = mockPlaylistTrackIds[id] ?? []
  const next = [...orderedIds]
  for (const trackId of existing) {
    if (!next.includes(trackId)) next.push(trackId)
  }
  mockPlaylistTrackIds[id] = next
  const playlist = mockPlaylistById(id)
  if (playlist) playlist.updatedAt = nowStamp()
}

function mockSmartPlaylistTracks(criteria: SmartPlaylistCriteria): Track[] {
  const genre = criteria.genre.trim().toLowerCase()
  return mockTracks.filter((track) => {
    if (genre && !track.genre.toLowerCase().includes(genre)) return false
    if (criteria.yearStart !== null && (track.year ?? 0) < criteria.yearStart) return false
    if (criteria.yearEnd !== null && (track.year ?? 0) > criteria.yearEnd) return false
    if (criteria.minDurationMs !== null && track.durationMs < criteria.minDurationMs) return false
    if (criteria.maxDurationMs !== null && track.durationMs > criteria.maxDurationMs) return false
    return true
  })
}

function mockCreateSmartPlaylist(
  name: string,
  description: string | null,
  criteria: SmartPlaylistCriteria,
): PlaylistDetail {
  const playlist = mockCreatePlaylist(name, description)
  playlist.isSmart = true
  const tracks = mockSmartPlaylistTracks(criteria)
  mockPlaylistTrackIds[playlist.id] = tracks.map((track) => track.id)
  syncMockPlaylistCounts()
  return { playlist: { ...playlist }, tracks }
}

function filterMockTracks(options: ListTracksOptions): Track[] {
  const query = options.query?.trim().toLowerCase() || ''
  let result = mockTracks
  if (query) {
    result = result.filter((track) =>
      [track.title, track.artist, track.album].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }
  const [rawKey, rawDir] = (options.sort || 'title:asc').split(':')
  const dir = rawDir === 'desc' ? -1 : 1
  const keyMap: Record<string, keyof Track> = {
    title: 'title',
    artist: 'artist',
    album: 'album',
    duration: 'durationMs',
    added: 'addedAt',
  }
  const key = keyMap[rawKey] ?? 'title'
  result = [...result].sort((a, b) => {
    const av = String(a[key] ?? '')
    const bv = String(b[key] ?? '')
    return av.localeCompare(bv, 'zh-CN') * dir
  })
  const page = options.page ?? 0
  const limit = options.limit ?? 2000
  return result.slice(page * limit, (page + 1) * limit)
}

export async function exportPlaylistM3U(
  name: string,
  tracks: Track[],
): Promise<string | null> {
  const content = [
    '#EXTM3U',
    ...tracks.map(
      (track) =>
        `#EXTINF:${Math.round(track.durationMs / 1000)},${track.artist || '未知艺人'} - ${track.title}\n${track.path}`,
    ),
  ].join('\n')

  if (!isTauriRuntime()) {
    const blob = new Blob([content], { type: 'audio/x-mpegurl' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name}.m3u`
    anchor.click()
    URL.revokeObjectURL(url)
    return `${name}.m3u`
  }

  const filePath = await save({
    defaultPath: `${name}.m3u`,
    filters: [{ name: '播放列表', extensions: ['m3u', 'm3u8'] }],
  })
  if (!filePath) return null
  await invoke('export_m3u', { filePath, content })
  return filePath
}
