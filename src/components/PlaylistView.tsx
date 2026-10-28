import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  GripVertical,
  Image as ImageIcon,
  ListPlus,
  Loader2,
  Music2,
  Pause,
  Pencil,
  Play,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { Playlist, SmartPlaylistCriteria, Track } from '../types/track'
import {
  coverUrl,
  exportPlaylistM3U,
  pickImage,
  previewSmartPlaylist,
} from '../lib/tauri'
import { trackCoverStyle } from '../lib/cover'
import { usePlaylistStore } from '../store/playlist'
import { usePlayerStore } from '../store/player'
import { useLibraryStore } from '../store/library'
import { useUiStore } from '../store/ui'
import { IconButton } from './ui/IconButton'
import { Tag } from './ui/Tag'
import { TrackEditModal } from './TrackEditModal'

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

function genreColor(genre: string): string {
  return genrePalette[genre] ?? '#9AA7C4'
}

function formatDuration(ms: number): string {
  if (!ms) return '--:--'
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatPlaylistDuration(ms: number): string {
  if (!ms) return '0 分钟'
  const total = Math.round(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function matchesQuery(track: Track, query: string): boolean {
  if (!query) return true
  const needle = query.trim().toLowerCase()
  return [track.title, track.artist, track.album, track.genre].some((value) =>
    value.toLowerCase().includes(needle),
  )
}

function parseNumber(value: string): number | null {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : null
}

interface ModalProps {
  onClose: () => void
}

function EditPlaylistModal({
  playlist,
  onClose,
}: {
  playlist: Playlist
  onClose: () => void
}) {
  const update = usePlaylistStore((s) => s.update)
  const updateCover = usePlaylistStore((s) => s.updateCover)
  const [name, setName] = useState(playlist.name)
  const [description, setDescription] = useState(playlist.description ?? '')
  const [busy, setBusy] = useState(false)
  const url = coverUrl(playlist.coverPath)

  const handleSave = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    await update(playlist.id, {
      name: name.trim(),
      description: description.trim() || null,
    })
    setBusy(false)
    onClose()
  }

  const handlePickCover = async () => {
    const path = await pickImage()
    if (path === null) return
    setBusy(true)
    await updateCover(playlist.id, path)
    setBusy(false)
    onClose()
  }

  const handleRemoveCover = async () => {
    if (!playlist.coverPath || busy) return
    setBusy(true)
    await updateCover(playlist.id, null)
    setBusy(false)
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal glass-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>编辑歌单</h2>
          <IconButton title="关闭" aria-label="关闭编辑歌单" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="track-edit-layout">
          <div className="modal-cover" style={trackCoverStyle(playlist.name)}>
            {url ? <img src={url} alt="" /> : <Music2 size={30} />}
            <div className="modal-cover-actions">
              <button type="button" onClick={() => void handlePickCover()} disabled={busy}>
                <ImageIcon size={13} />
                <span>选择</span>
              </button>
              {playlist.coverPath ? (
                <button
                  type="button"
                  className="danger"
                  onClick={() => void handleRemoveCover()}
                  disabled={busy}
                >
                  <Trash2 size={13} />
                  <span>移除</span>
                </button>
              ) : null}
            </div>
          </div>
          <div className="form-grid track-edit-fields">
            <div className="field full">
              <label htmlFor="playlist-name">名称</label>
              <input
                id="playlist-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="field full">
              <label htmlFor="playlist-description">简介</label>
              <textarea
                id="playlist-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="写一句这个歌单的气质"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleSave()}
            disabled={busy || !name.trim()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : null}
            <span>保存</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const genreSuggestions = ['电子', '爵士', '古典', '摇滚', '氛围', '民谣', '独立', '轻音乐']

function SmartPlaylistModal({ onClose }: ModalProps) {
  const createSmart = usePlaylistStore((s) => s.createSmart)
  const openPlaylist = useUiStore((s) => s.openPlaylist)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('')
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')
  const [minMinutes, setMinMinutes] = useState('')
  const [maxMinutes, setMaxMinutes] = useState('')
  const [preview, setPreview] = useState<Track[]>([])
  const [previewLoading, setPreviewLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const criteria = useMemo<SmartPlaylistCriteria>(() => {
    const minValue = parseNumber(minMinutes)
    const maxValue = parseNumber(maxMinutes)
    return {
      genre: genre.trim(),
      yearStart: parseNumber(yearStart),
      yearEnd: parseNumber(yearEnd),
      minDurationMs: minValue !== null ? minValue * 60 * 1000 : null,
      maxDurationMs: maxValue !== null ? maxValue * 60 * 1000 : null,
    }
  }, [genre, yearStart, yearEnd, minMinutes, maxMinutes])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setPreviewLoading(true)
      void previewSmartPlaylist(criteria)
        .then((tracks) => {
          if (!cancelled) {
            setPreview(tracks)
            setPreviewLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPreview([])
            setPreviewLoading(false)
          }
        })
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [criteria])

  const handleCreate = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const detail = await createSmart({
      name: name.trim(),
      description: description.trim() || null,
      genre: criteria.genre,
      yearStart: criteria.yearStart,
      yearEnd: criteria.yearEnd,
      minDurationMs: criteria.minDurationMs,
      maxDurationMs: criteria.maxDurationMs,
    })
    setBusy(false)
    if (detail) {
      openPlaylist(detail.playlist.id)
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal modal-wide glass-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>新建智能歌单</h2>
          <IconButton title="关闭" aria-label="关闭智能歌单" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="smart-name">名称</label>
            <input
              id="smart-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：深夜电子"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="smart-genre">流派</label>
            <input
              id="smart-genre"
              list="smart-genre-options"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              placeholder="不限定可留空"
            />
            <datalist id="smart-genre-options">
              {genreSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div className="field full">
            <label htmlFor="smart-description">简介</label>
            <input
              id="smart-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="可选"
            />
          </div>
          <div className="field">
            <label htmlFor="smart-year-start">年份从</label>
            <input
              id="smart-year-start"
              value={yearStart}
              onChange={(event) => setYearStart(event.target.value)}
              placeholder="2018"
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label htmlFor="smart-year-end">年份到</label>
            <input
              id="smart-year-end"
              value={yearEnd}
              onChange={(event) => setYearEnd(event.target.value)}
              placeholder="2026"
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label htmlFor="smart-min">最短时长（分钟）</label>
            <input
              id="smart-min"
              value={minMinutes}
              onChange={(event) => setMinMinutes(event.target.value)}
              placeholder="2"
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label htmlFor="smart-max">最长时长（分钟）</label>
            <input
              id="smart-max"
              value={maxMinutes}
              onChange={(event) => setMaxMinutes(event.target.value)}
              placeholder="8"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="smart-preview">
          <div className="smart-preview-head">
            <span>
              <Sparkles size={12} />
              匹配结果
            </span>
            {previewLoading ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <b>{preview.length} 首</b>
            )}
          </div>
          {previewLoading ? (
            <div className="smart-preview-empty">正在计算匹配曲目…</div>
          ) : preview.length > 0 ? (
            preview.slice(0, 3).map((track) => {
              const url = coverUrl(track.coverPath)
              return (
                <div className="smart-preview-track" key={track.id}>
                  <div className="smart-preview-cover" style={trackCoverStyle(track.path)}>
                    {url ? <img src={url} alt="" /> : <Music2 size={13} />}
                  </div>
                  <div className="smart-preview-copy">
                    <b>{track.title}</b>
                    <span>{track.artist || '未知艺人'}</span>
                  </div>
                  <span className="add-track-meta">{formatDuration(track.durationMs)}</span>
                </div>
              )
            })
          ) : (
            <div className="smart-preview-empty">当前条件下没有匹配的曲目</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleCreate()}
            disabled={busy || !name.trim()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>创建</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function AddTracksModal({
  playlistId,
  existingIds,
  onClose,
}: {
  playlistId: number
  existingIds: Set<number>
  onClose: () => void
}) {
  const tracks = useLibraryStore((s) => s.tracks)
  const addTracks = usePlaylistStore((s) => s.addTracks)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  const available = useMemo(
    () => tracks.filter((track) => !existingIds.has(track.id)),
    [tracks, existingIds],
  )
  const filtered = available.filter((track) => matchesQuery(track, query))

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const togglePage = () => {
    const visibleIds = filtered.map((track) => track.id)
    setSelected((current) => {
      const next = new Set(current)
      const allSelected = visibleIds.every((id) => next.has(id))
      for (const id of visibleIds) {
        if (allSelected) {
          next.delete(id)
        } else {
          next.add(id)
        }
      }
      return next
    })
  }

  const handleAdd = async () => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    await addTracks(playlistId, [...selected])
    setBusy(false)
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal modal-wide glass-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>添加曲目</h2>
          <IconButton title="关闭" aria-label="关闭添加曲目" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="search-box add-track-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索音乐库"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              aria-label="清空搜索"
              onClick={() => setQuery('')}
            >
              <X size={11} />
            </button>
          ) : null}
        </div>

        <div className="add-track-toolbar">
          <button
            type="button"
            className="text-btn"
            onClick={togglePage}
            disabled={filtered.length === 0}
          >
            {filtered.every((track) => selected.has(track.id))
              ? '取消全选'
              : '全选当前结果'}
          </button>
          <span className="toolbar-count">{selected.size} 首已选</span>
        </div>

        <div className="add-track-list">
          {filtered.length === 0 ? (
            <div className="classify-empty">
              <Music2 size={24} />
              <h2>没有可添加的曲目</h2>
              <p>音乐库中的曲目都已在这份歌单里，或本地库还没有曲目。</p>
            </div>
          ) : (
            filtered.map((track) => {
              const url = coverUrl(track.coverPath)
              const checked = selected.has(track.id)
              return (
                <label
                  key={track.id}
                  className={`add-track-row ${checked ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(track.id)}
                  />
                  <span
                    className="add-track-cover"
                    style={trackCoverStyle(track.path)}
                  >
                    {url ? <img src={url} alt="" /> : <Music2 size={14} />}
                  </span>
                  <span className="add-track-copy">
                    <b>{track.title}</b>
                    <span>{track.artist || '未知艺人'}</span>
                  </span>
                  {track.genre ? (
                    <Tag color={genreColor(track.genre)}>{track.genre}</Tag>
                  ) : null}
                  <span className="add-track-meta">
                    {formatDuration(track.durationMs)}
                  </span>
                </label>
              )
            })
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleAdd()}
            disabled={busy || selected.size === 0}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <ListPlus size={14} />}
            <span>加入歌单</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function PlaylistView() {
  const active = usePlaylistStore((s) => s.active)
  const open = usePlaylistStore((s) => s.open)
  const remove = usePlaylistStore((s) => s.remove)
  const removeTracks = usePlaylistStore((s) => s.removeTracks)
  const reorder = usePlaylistStore((s) => s.reorder)
  const updateTrack = usePlaylistStore((s) => s.updateTrack)
  const setTrackCover = usePlaylistStore((s) => s.setTrackCover)
  const playContext = usePlayerStore((s) => s.playContext)
  const currentTrackId = usePlayerStore((s) => s.current?.id ?? null)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const activePlaylistId = useUiStore((s) => s.activePlaylistId)
  const clearActivePlaylist = useUiStore((s) => s.clearActivePlaylist)
  const setNav = useUiStore((s) => s.setNav)
  const playlistError = usePlaylistStore((s) => s.error)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showEdit, setShowEdit] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showSmart, setShowSmart] = useState(false)
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  useEffect(() => {
    if (activePlaylistId !== null && active?.playlist.id !== activePlaylistId) {
      void open(activePlaylistId)
    }
  }, [activePlaylistId, active, open])

  const tracks = active?.tracks ?? []
  const filteredTracks = useMemo(
    () => tracks.filter((track) => matchesQuery(track, query)),
    [tracks, query],
  )
  const allSelected =
    filteredTracks.length > 0 &&
    filteredTracks.every((track) => selected.has(track.id))

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current)
      if (allSelected) {
        for (const track of filteredTracks) next.delete(track.id)
      } else {
        for (const track of filteredTracks) next.add(track.id)
      }
      return next
    })
  }

  const handleRemoveSelected = async () => {
    if (!active || selected.size === 0) return
    await removeTracks(active.playlist.id, [...selected])
    setSelected(new Set())
  }

  const handlePlay = (index: number) => {
    if (tracks.length === 0) return
    void playContext(tracks, index)
  }

  const handlePlayTrack = (track: Track) => {
    const index = tracks.findIndex((item) => item.id === track.id)
    if (index >= 0) handlePlay(index)
  }

  const handleShuffle = () => {
    if (tracks.length === 0) return
    const index = Math.floor(Math.random() * tracks.length)
    void playContext(tracks, index)
  }

  const handleExport = async () => {
    if (!active || tracks.length === 0) return
    await exportPlaylistM3U(active.playlist.name, tracks)
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (index: number) => {
    if (dragIndex !== null && index !== dragIndex) setDropIndex(index)
  }

  const handleDrop = () => {
    if (!active || dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    const next = [...tracks]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    void reorder(active.playlist.id, next.map((track) => track.id))
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDelete = async () => {
    if (!active) return
    if (!window.confirm(`删除歌单“${active.playlist.name}”？`)) return
    await remove(active.playlist.id)
    clearActivePlaylist()
    setNav('home')
  }

  if (active === null || active.playlist.id !== activePlaylistId) {
    return (
      <div className="content playlist-view">
        <div className="playlist-loading">
          <Loader2 size={22} className="spin" />
          <span>正在加载歌单</span>
        </div>
      </div>
    )
  }

  const playlist = active.playlist
  const cover = coverUrl(playlist.coverPath)
  const existingIds = new Set(tracks.map((track) => track.id))

  return (
    <div className="content playlist-view">
      <div className="playlist-hero">
        <div
          className="playlist-hero-cover"
          style={trackCoverStyle(playlist.name)}
        >
          {cover ? <img src={cover} alt="" /> : null}
          {playlist.isSmart ? <Sparkles size={30} /> : <Music2 size={30} />}
        </div>
        <div className="playlist-hero-copy">
          <div className="playlist-title-line">
            <h1>{playlist.name}</h1>
            {playlist.isSmart ? (
              <Tag color="#8FB8FF">
                <Sparkles size={11} />
                智能歌单
              </Tag>
            ) : null}
          </div>
          <p>{playlist.description || '一份属于你的音乐合集'}</p>
          <div className="playlist-meta">
            <span>{playlist.trackCount} 首</span>
            <span>共 {formatPlaylistDuration(playlist.totalDurationMs)}</span>
            <span>更新于 {formatUpdatedAt(playlist.updatedAt)}</span>
          </div>
          <div className="hero-actions playlist-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => handlePlay(0)}
              disabled={tracks.length === 0}
            >
              <Play size={15} />
              <span>播放</span>
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleShuffle}
              disabled={tracks.length === 0}
            >
              <span>随机播放</span>
            </button>
            <IconButton
              title="添加曲目"
              aria-label="添加曲目"
              onClick={() => setShowAdd(true)}
            >
              <ListPlus size={16} />
            </IconButton>
            <IconButton
              title="智能歌单"
              aria-label="新建智能歌单"
              onClick={() => setShowSmart(true)}
            >
              <Sparkles size={16} />
            </IconButton>
            <IconButton
              title="编辑歌单"
              aria-label="编辑歌单"
              onClick={() => setShowEdit(true)}
            >
              <Pencil size={15} />
            </IconButton>
            <IconButton
              title="导出 M3U"
              aria-label="导出 M3U"
              onClick={() => void handleExport()}
              disabled={tracks.length === 0}
            >
              <Download size={16} />
            </IconButton>
            <IconButton
              title="删除歌单"
              aria-label="删除歌单"
              tone="warm"
              onClick={() => void handleDelete()}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="playlist-toolbar">
        <div className="search-box">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索歌单内曲目"
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              aria-label="清空搜索"
              onClick={() => setQuery('')}
            >
              <X size={11} />
            </button>
          ) : null}
        </div>
        <div className="playlist-toolbar-right">
          {tracks.length > 0 ? (
            <>
              <button type="button" className="text-btn" onClick={togglePage}>
                {allSelected ? '取消全选' : '全选'}
              </button>
              <span className="selection-count">
                {selected.size > 0
                  ? `已选 ${selected.size} 首`
                  : `${filteredTracks.length} 首`}
              </span>
              {selected.size > 0 ? (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => void handleRemoveSelected()}
                >
                  <Trash2 size={13} />
                  <span>移除</span>
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {playlistError ? <div className="error-banner">{playlistError}</div> : null}

      <div className="playlist-list">
        {tracks.length === 0 ? (
          <div className="classify-empty playlist-empty">
            <Music2 size={26} />
            <h2>歌单还是空的</h2>
            <p>从音乐库挑选曲目加入歌单，或创建一个按条件自动收集的智能歌单。</p>
            <button className="primary-btn" onClick={() => setShowAdd(true)}>
              <ListPlus size={15} />
              <span>添加曲目</span>
            </button>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="classify-empty playlist-empty">
            <Search size={26} />
            <h2>没有匹配的曲目</h2>
            <p>换个关键词再试试。</p>
          </div>
        ) : (
          filteredTracks.map((track, index) => {
            const url = coverUrl(track.coverPath)
            const isCurrent = track.id === currentTrackId
            const isSelected = selected.has(track.id)
            return (
              <div
                key={track.id}
                className={`playlist-row ${isCurrent ? 'current' : ''} ${
                  isPlaying && isCurrent ? 'playing' : ''
                } ${isSelected ? 'selected' : ''} ${
                  dragIndex === index ? 'dragging' : ''
                } ${dropIndex === index ? 'drop-target' : ''}`}
                draggable={!query}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => {
                  event.preventDefault()
                  handleDragOver(index)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDrop()
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setDropIndex(null)
                }}
                onClick={() => handlePlayTrack(track)}
              >
                <span className="playlist-drag" title="拖拽排序">
                  <GripVertical size={14} />
                </span>
                <label className="row-check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(track.id)}
                  />
                </label>
                <span className="playlist-track-cover" style={trackCoverStyle(track.path)}>
                  {url ? <img src={url} alt="" /> : <Music2 size={15} />}
                  <span className="track-play-btn">
                    {isCurrent && isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  </span>
                </span>
                <span className="playlist-track-main">
                  <b>{track.title}</b>
                  <span>{track.artist || '未知艺人'}</span>
                </span>
                <span className="playlist-track-album">{track.album || '未知专辑'}</span>
                {track.genre ? (
                  <span className="playlist-track-genre">
                    <Tag color={genreColor(track.genre)}>{track.genre}</Tag>
                  </span>
                ) : (
                  <span className="genre-empty">未分类</span>
                )}
                <span className="playlist-track-duration">
                  {formatDuration(track.durationMs)}
                </span>
                <IconButton
                  title="编辑曲目"
                  aria-label="编辑曲目"
                  onClick={(event) => {
                    event.stopPropagation()
                    setEditingTrack(track)
                  }}
                >
                  <Pencil size={13} />
                </IconButton>
              </div>
            )
          })
        )}
      </div>

      {showEdit ? (
        <EditPlaylistModal playlist={playlist} onClose={() => setShowEdit(false)} />
      ) : null}
      {showAdd ? (
        <AddTracksModal
          playlistId={playlist.id}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
        />
      ) : null}
      {showSmart ? <SmartPlaylistModal onClose={() => setShowSmart(false)} /> : null}
      {editingTrack ? (
        <TrackEditModal
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSave={async (patch) => {
            await updateTrack(editingTrack.id, patch)
          }}
          onCoverChange={async (coverPath) => {
            await setTrackCover(editingTrack.id, coverPath)
          }}
        />
      ) : null}
    </div>
  )
}
