import { AudioWaveform, HardDrive, Heart, Home, LibraryBig, Plus, Sparkles } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { useLibraryStore } from '../store/library'
import type { NavKey } from '../store/ui'
import { IconButton } from './ui/IconButton'

const navItems: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'library', label: '音乐库', icon: LibraryBig },
  { key: 'classify', label: '智能分类', icon: Sparkles },
  { key: 'visual', label: '播放特效', icon: AudioWaveform },
]

const playlists = [
  { name: '深夜通勤', count: '128 首', color: 'linear-gradient(135deg,#4D8DFF,#2B5BE8)' },
  { name: '周末阅读', count: '46 首', color: 'linear-gradient(135deg,#2FE0C8,#1E8E88)' },
  { name: '运动节奏', count: '89 首', color: 'linear-gradient(135deg,#FF7D6B,#FFB36B)' },
  { name: '我的收藏', count: '215 首', color: 'linear-gradient(135deg,#D8C4FF,#8A6CFF)', heart: true },
]

export function Sidebar() {
  const nav = useUiStore((s) => s.nav)
  const setNav = useUiStore((s) => s.setNav)
  const stats = useLibraryStore((s) => s.stats)
  const scanning = useLibraryStore((s) => s.scanning)
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  const trackCount = stats?.trackCount ?? 0
  const folderCount = stats?.folderCount ?? 0

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
        <IconButton title="新建歌单" aria-label="新建歌单">
          <Plus size={16} />
        </IconButton>
      </div>

      {playlists.map((pl) => (
        <div key={pl.name} className="playlist-item">
          <div className="pl-cover" style={{ background: pl.color }}>
            {pl.heart ? <Heart size={13} /> : <AudioWaveform size={13} />}
          </div>
          <div className="pl-meta">
            <b>{pl.name}</b>
            <span>{pl.count}</span>
          </div>
        </div>
      ))}

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
