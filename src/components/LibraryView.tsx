import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Disc3,
  FolderPlus,
  HardDrive,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import type { Track } from '../types/track'
import { coverUrl, isTauriRuntime, onScanProgress, pickFolders } from '../lib/tauri'
import { trackCoverStyle } from '../lib/cover'
import { useLibraryStore } from '../store/library'
import { usePlayerStore } from '../store/player'
import type { SortKey } from '../store/library'
import { IconButton } from './ui/IconButton'
import { Tag } from './ui/Tag'

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'title', label: '标题' },
  { key: 'artist', label: '艺人' },
  { key: 'album', label: '专辑' },
  { key: 'duration', label: '时长' },
  { key: 'added', label: '最近添加' },
]

const genrePalette: Record<string, string> = {
  电子: '#8FB8FF',
  Electronic: '#8FB8FF',
  古典: '#D8C4FF',
  Classical: '#D8C4FF',
  爵士: '#FFC978',
  Jazz: '#FFC978',
  摇滚: '#FF8E8E',
  Rock: '#FF8E8E',
  氛围: '#7DE0C8',
  Ambient: '#7DE0C8',
  民谣: '#A7E29A',
  Acoustic: '#A7E29A',
}

function formatDuration(ms: number): string {
  if (!ms) return '--:--'
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatBitrate(bitrate: number | null): string {
  if (!bitrate) return '未知码率'
  return `${Math.round(bitrate / 1000)} kbps`
}

function formatDate(iso: string): string {
  const date = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TrackDetail({
  track,
  onClose,
  onPlay,
}: {
  track: Track
  onClose: () => void
  onPlay: () => void
}) {
  const url = coverUrl(track.coverPath)
  return (
    <aside className="track-detail glass-card">
      <div className="detail-head">
        <span className="detail-title">曲目详情</span>
        <IconButton title="关闭" aria-label="关闭详情" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>
      <div className="detail-cover" style={trackCoverStyle(track.path)}>
        {url ? <img src={url} alt="" /> : <Music2 size={34} />}
      </div>
      <h2>{track.title}</h2>
      <p className="detail-artist">
        {track.artist || '未知艺人'}
        <span> · </span>
        {track.album || '未知专辑'}
      </p>
      <Tag color={genreColor(track.genre)}>{track.genre || '未分类'}</Tag>
      <div className="detail-meta">
        <span>
          <Clock3 size={14} />
          {formatDuration(track.durationMs)}
        </span>
        <span>
          <Disc3 size={14} />
          {formatBitrate(track.bitrate)}
        </span>
        <span>
          <HardDrive size={14} />
          {formatSize(track.sizeBytes)}
        </span>
        <span>
          <ListMusic size={14} />
          {formatDate(track.addedAt)}
        </span>
      </div>
      <div className="detail-path">{track.path}</div>
      <button className="detail-play" onClick={onPlay}>
        <Play size={15} fill="currentColor" />
        <span>播放</span>
      </button>
    </aside>
  )
}

function genreColor(genre: string): string {
  return genrePalette[genre] ?? '#9AA7C4'
}

export function LibraryView() {
  const tracks = useLibraryStore((s) => s.tracks)
  const stats = useLibraryStore((s) => s.stats)
  const query = useLibraryStore((s) => s.query)
  const sortKey = useLibraryStore((s) => s.sortKey)
  const sortDir = useLibraryStore((s) => s.sortDir)
  const loading = useLibraryStore((s) => s.loading)
  const scanning = useLibraryStore((s) => s.scanning)
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  const error = useLibraryStore((s) => s.error)
  const setQuery = useLibraryStore((s) => s.setQuery)
  const setSortKey = useLibraryStore((s) => s.setSortKey)
  const toggleSortDir = useLibraryStore((s) => s.toggleSortDir)
  const refresh = useLibraryStore((s) => s.refresh)
  const loadMore = useLibraryStore((s) => s.loadMore)
  const addFolders = useLibraryStore((s) => s.addFolders)
  const playContext = usePlayerStore((s) => s.playContext)
  const currentTrack = usePlayerStore((s) => s.current)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const togglePlay = usePlayerStore((s) => s.togglePlay)

  const [localQuery, setLocalQuery] = useState(query)
  const [selected, setSelected] = useState<Track | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(localQuery), 220)
    return () => window.clearTimeout(timer)
  }, [localQuery, setQuery])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    onScanProgress((progress) => {
      useLibraryStore.setState({
        scanning: progress.status === 'scanning',
        scanProgress: progress,
      })
      if (progress.status === 'done') {
        window.setTimeout(() => void useLibraryStore.getState().refresh(), 400)
      }
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  })

  const statLine = useMemo(() => {
    if (!stats) return '正在读取本地音乐库…'
    if (stats.trackCount === 0) return '还没有音乐，添加目录开始建立索引'
    return `${stats.trackCount} 首 · ${stats.folderCount} 个目录 · 总时长 ${formatDuration(
      stats.totalDurationMs,
    )}`
  }, [stats])

  const scanPercent = useMemo(() => {
    if (!scanProgress || scanProgress.total === 0) return 0
    return Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100))
  }, [scanProgress])

  const handleAddFolders = async () => {
    const paths = await pickFolders()
    if (paths.length > 0) await addFolders(paths)
  }

  const handlePlayTrack = (track: Track) => {
    const index = tracks.findIndex((item) => item.id === track.id)
    void playContext(tracks, index < 0 ? 0 : index)
  }

  return (
    <div className="content library-view">
      <div className="library-inner">
        <header className="library-head">
          <div>
            <div className="library-title-row">
              <h1>音乐库</h1>
              {!isTauriRuntime() && <Tag color="#D8C4FF">浏览器预览</Tag>}
            </div>
            <p className="library-sub">{statLine}</p>
          </div>
          <div className="library-actions">
            <IconButton
              title="刷新"
              aria-label="刷新音乐库"
              onClick={() => void refresh()}
              disabled={loading}
              className={loading ? 'is-busy' : ''}
            >
              <RefreshCw size={16} />
            </IconButton>
            <button className="primary-btn" onClick={() => void handleAddFolders()}>
              <FolderPlus size={16} />
              <span>添加目录</span>
            </button>
          </div>
        </header>

        {scanning && scanProgress ? (
          <div className="scan-banner">
            <div className="scan-copy">
              <Loader2 size={15} className="spin" />
              <div>
                <b>{scanProgress.message}</b>
                <span>{scanProgress.root}</span>
              </div>
            </div>
            <div className="scan-bar">
              <i style={{ width: `${scanPercent}%` }} />
            </div>
            <span className="scan-count">{scanProgress.found} 首已入库</span>
          </div>
        ) : null}

        <div className="library-toolbar">
          <div className="search-box">
            <Search size={15} />
            <input
              value={localQuery}
              onChange={(event) => setLocalQuery(event.target.value)}
              placeholder="搜索标题、艺人、专辑"
              aria-label="搜索音乐"
            />
            {localQuery ? (
              <button
                className="search-clear"
                onClick={() => setLocalQuery('')}
                aria-label="清空搜索"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
          <div className="toolbar-right">
            <span className="toolbar-count">{tracks.length} 首</span>
            <div className="sort-control">
              <label htmlFor="sort-select">排序</label>
              <select
                id="sort-select"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
              >
                {sortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <IconButton
                title="切换排序方向"
                aria-label="切换排序方向"
                onClick={toggleSortDir}
              >
                {sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </IconButton>
            </div>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="library-body">
          <div className="library-list-col">
            <div className="track-list-scroll" ref={scrollRef}>
              {tracks.length === 0 && !loading ? (
                <div className="track-empty">
                  <span className="empty-icon">
                    <Music2 size={26} />
                  </span>
                  <h2>{query ? '没有匹配的曲目' : '本地音乐库为空'}</h2>
                  <p>
                    {query
                      ? '换个关键词试试，或清空搜索查看全部曲目。'
                      : '添加一个音乐目录，Neptune 会自动扫描、解析元数据并建立索引。'}
                  </p>
                  {!query ? (
                    <button className="primary-btn" onClick={() => void handleAddFolders()}>
                      <FolderPlus size={16} />
                      <span>添加音乐目录</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div
                    className="track-virtual"
                    style={{ height: `${virtualizer.getTotalSize()}px` }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const track = tracks[virtualRow.index]
                      if (!track) return null
                      const url = coverUrl(track.coverPath)
                      const active = selected?.id === track.id
                      const isCurrent = currentTrack?.id === track.id
                      const rowClass = [
                        'track-row',
                        active ? 'active' : '',
                        isCurrent ? 'current' : '',
                        isCurrent && isPlaying ? 'playing' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                      return (
                        <div
                          key={virtualRow.key}
                          className={rowClass}
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                          onClick={() => setSelected(track)}
                        >
                          <div className="track-cover" style={trackCoverStyle(track.path)}>
                            {url ? <img src={url} alt="" loading="lazy" /> : <Music2 size={17} />}
                            <button
                              type="button"
                              className="track-play-btn"
                              title={isCurrent && isPlaying ? '暂停' : '播放'}
                              aria-label={isCurrent && isPlaying ? '暂停' : '播放'}
                              onClick={(event) => {
                                event.stopPropagation()
                                if (isCurrent && isPlaying) {
                                  togglePlay()
                                } else {
                                  handlePlayTrack(track)
                                }
                              }}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause size={14} fill="currentColor" />
                              ) : (
                                <Play size={14} fill="currentColor" />
                              )}
                            </button>
                          </div>
                          <div className="track-main">
                            <b>{track.title}</b>
                            <span>{track.artist || '未知艺人'}</span>
                          </div>
                          <div className="track-album">{track.album || '未知专辑'}</div>
                          <div className="track-genre">
                            {track.genre ? (
                              <Tag color={genreColor(track.genre)}>{track.genre}</Tag>
                            ) : (
                              <span className="genre-empty">未分类</span>
                            )}
                          </div>
                          <div className="track-duration">{formatDuration(track.durationMs)}</div>
                        </div>
                      )
                    })}
                  </div>
                  {tracks.length >= 2000 && !loading ? (
                    <button className="load-more" onClick={() => void loadMore()}>
                      加载更多
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {selected ? (
            <TrackDetail
              track={selected}
              onClose={() => setSelected(null)}
              onPlay={() => handlePlayTrack(selected)}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
