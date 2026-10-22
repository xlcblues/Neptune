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
