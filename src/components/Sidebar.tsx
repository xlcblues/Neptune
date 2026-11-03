import { useEffect, useRef, useState } from 'react'
import { AudioWaveform, Check, HardDrive, Home, LibraryBig, Monitor, Moon, Plus, Sparkles, Sun, Trash2, X } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { useLibraryStore } from '../store/library'
import { usePlaylistStore } from '../store/playlist'
import { useTheme, type ThemePreference } from '../theme'
import type { NavKey } from '../store/ui'
import { IconButton } from './ui/IconButton'
import { coverUrl } from '../lib/tauri'
import { trackCoverStyle } from '../lib/cover'

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

const navItems: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'library', label: '音乐库', icon: LibraryBig },
  { key: 'classify', label: '智能分类', icon: Sparkles },
  { key: 'visual', label: '播放特效', icon: AudioWaveform },
]

export function Sidebar() {
  const nav = useUiStore((s) => s.nav)
  const setNav = useUiStore((s) => s.setNav)
  const activePlaylistId = useUiStore((s) => s.activePlaylistId)
  const openPlaylist = useUiStore((s) => s.openPlaylist)
  const clearActivePlaylist = useUiStore((s) => s.clearActivePlaylist)
  const { preference, setPreference } = useTheme()
  const stats = useLibraryStore((s) => s.stats)
  const scanning = useLibraryStore((s) => s.scanning)
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  const playlists = usePlaylistStore((s) => s.playlists)
  const createPlaylist = usePlaylistStore((s) => s.create)
  const removePlaylist = usePlaylistStore((s) => s.remove)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const createBoxRef = useRef<HTMLDivElement>(null)
  const confirmBoxRef = useRef<HTMLDivElement>(null)
  const trackCount = stats?.trackCount ?? 0
  const folderCount = stats?.folderCount ?? 0

  const handleCreate = async () => {
    const playlist = await createPlaylist(newName.trim() || '新歌单')
    if (playlist) {
      openPlaylist(playlist.id)
      setNewName('')
    }
    setCreating(false)
  }

  const handleDelete = async (id: number) => {
    await removePlaylist(id)
    setConfirmingId(null)
    if (activePlaylistId === id) {
      clearActivePlaylist()
      setNav('home')
    }
  }

  useEffect(() => {
    if (!creating && confirmingId === null) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (creating && createBoxRef.current?.contains(target)) return
      if (confirmingId !== null && confirmBoxRef.current?.contains(target)) return
      setCreating(false)
      setConfirmingId(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [creating, confirmingId])

  useEffect(() => {
    if (!creating && confirmingId === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCreating(false)
      setConfirmingId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [creating, confirmingId])

  const progressPercent =
    scanning && scanProgress && scanProgress.total > 0
      ? Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100))
      : trackCount > 0
        ? 100
        : 0

  const lastScan =
    stats?.lastScannedAt && trackCount > 0
      ? `上次扫描 ${stats.lastScannedAt.slice(0, 16).replace('T', ' ')}`
      : scanning
        ? '正在扫描目录…'
        : '尚未添加目录'

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo/neptune-symbol.svg" alt="" />
        <span className="brand-name">Neptune</span>
      </div>

      <div className="nav-label">浏览</div>
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.key}
            className={`nav-item ${nav === item.key ? 'active' : ''}`}
            onClick={() => setNav(item.key)}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        )
      })}

      <div className="playlist-head">
        <span className="nav-label">我的歌单</span>
        <IconButton
          title="新建歌单"
          aria-label="新建歌单"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} />
        </IconButton>
      </div>

      {creating ? (
        <div className="playlist-create" ref={createBoxRef}>
          <div className="pl-create-field">
            <Plus size={13} />
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing === false) {
                  void handleCreate()
                }
              }}
              placeholder="歌单名称"
              autoFocus
            />
          </div>
          <div className="pl-create-actions">
            <button
              type="button"
              className="pl-create-cancel"
              onClick={() => setCreating(false)}
            >
              <X size={12} />
              取消
            </button>
            <button
              type="button"
              className="pl-create-btn"
              onClick={() => void handleCreate()}
            >
              <Check size={12} />
              创建
            </button>
          </div>
        </div>
      ) : null}

      {playlists.length === 0 ? (
        <div className="playlist-empty">暂无歌单</div>
      ) : (
        playlists.map((playlist) => {
          const url = coverUrl(playlist.coverPath)
          const active = nav === 'playlist' && activePlaylistId === playlist.id
          if (confirmingId === playlist.id) {
            return (
              <div
                key={playlist.id}
                className="playlist-confirm"
                ref={confirmBoxRef}
              >
                <div className="pl-confirm-copy">
                  <span className="pl-confirm-icon">
                    <Trash2 size={13} />
                  </span>
                  <span className="pl-confirm-text">删除“{playlist.name}”？</span>
                </div>
                <div className="pl-confirm-actions">
                  <button
                    type="button"
                    className="pl-confirm-cancel"
                    onClick={() => setConfirmingId(null)}
                  >
                    <X size={12} />
                    取消
                  </button>
                  <button
                    type="button"
                    className="pl-confirm-delete"
                    onClick={() => void handleDelete(playlist.id)}
                  >
                    <Trash2 size={12} />
                    删除
                  </button>
                </div>
              </div>
            )
          }
          return (
            <div
              key={playlist.id}
              className={`playlist-item ${active ? 'active' : ''}`}
              onClick={() => openPlaylist(playlist.id)}
            >
              <div className="pl-cover" style={trackCoverStyle(playlist.name)}>
                {url ? (
                  <img src={url} alt="" />
                ) : playlist.isSmart ? (
                  <Sparkles size={13} />
                ) : (
                  <AudioWaveform size={13} />
                )}
              </div>
              <div className="pl-meta">
                <b>{playlist.name}</b>
                <span>{playlist.trackCount} 首</span>
              </div>
              <button
                type="button"
                className="playlist-delete"
                title="删除歌单"
                aria-label="删除歌单"
                onClick={(event) => {
                  event.stopPropagation()
                  setConfirmingId(playlist.id)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })
      )}

      <div className="theme-control">
        <span className="nav-label">外观</span>
        <div className="theme-switch" role="group" aria-label="外观主题">
          {themeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                className={preference === option.value ? 'active' : ''}
                title={option.label}
                aria-label={option.label}
                aria-pressed={preference === option.value}
                onClick={() => setPreference(option.value)}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
      </div>

      <button className="storage" onClick={() => setNav('library')}>
        <div className="storage-head">
          <HardDrive size={15} />
          <span>本地音乐库</span>
        </div>
        <div className="storage-sub">
          {trackCount > 0 ? `${trackCount} 首 · ${folderCount} 个目录` : lastScan}
        </div>
        <div className={`progress-mini ${scanning ? 'scanning' : ''}`}>
          <i style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="storage-note">{lastScan}</div>
      </button>
    </aside>
  )
}
