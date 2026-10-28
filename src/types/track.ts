export interface Track {
  id: number
  path: string
  title: string
  artist: string
  album: string
  genre: string
  durationMs: number
  bitrate: number | null
  sampleRate: number | null
  channels: number | null
  coverPath: string | null
  sizeBytes: number
  addedAt: string
  updatedAt: string
  year: number | null
}

export interface LibraryStats {
  trackCount: number
  folderCount: number
  totalDurationMs: number
  totalSizeBytes: number
  lastScannedAt: string | null
}

export interface ScanProgress {
  root: string
  total: number
  current: number
  found: number
  status: string
  message: string
}

export type ClassificationStatus = 'classified' | 'pending' | 'unclassified'

export interface ClassificationItem {
  id: number
  title: string
  artist: string
  album: string
  currentGenre: string
  suggestedGenre: string | null
  confidence: number | null
  source: 'metadata' | 'local' | 'network' | 'manual' | null
  status: ClassificationStatus
}

export interface ClassifyStats {
  total: number
  classified: number
  pending: number
  unclassified: number
  sourceCounts: Record<string, number>
}

export interface ClassificationPage {
  items: ClassificationItem[]
  stats: ClassifyStats
}

export interface ClassifyProgress {
  total: number
  current: number
  found: number
  status: string
  message: string
}

export interface Playlist {
  id: number
  name: string
  description: string | null
  coverPath: string | null
  createdAt: string
  updatedAt: string
  isSmart: boolean
  trackCount: number
  totalDurationMs: number
}

export interface PlaylistDetail {
  playlist: Playlist
  tracks: Track[]
}

export interface SmartPlaylistCriteria {
  genre: string
  yearStart: number | null
  yearEnd: number | null
  minDurationMs: number | null
  maxDurationMs: number | null
}
