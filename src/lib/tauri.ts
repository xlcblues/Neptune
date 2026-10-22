import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import type { LibraryStats, ScanProgress, Track } from '../types/track'

export { convertFileSrc }

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function coverUrl(path: string | null | undefined): string {
  if (!path || !isTauriRuntime()) return ''
  return convertFileSrc(path)
}

export async function pickFolders(): Promise<string[]> {
  if (!isTauriRuntime()) return []
  const selected = await open({ directory: true, multiple: true })
  if (!selected) return []
  return Array.isArray(selected) ? selected : [selected]
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
  },
]

const mockStats: LibraryStats = {
  trackCount: mockTracks.length,
  folderCount: 2,
  totalDurationMs: mockTracks.reduce((sum, track) => sum + track.durationMs, 0),
  totalSizeBytes: mockTracks.reduce((sum, track) => sum + track.sizeBytes, 0),
  lastScannedAt: '2026-10-21 18:02:11',
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
