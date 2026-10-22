import { FolderPlus, ListMusic, Boxes, HardDrive, ArrowRight } from 'lucide-react'
import { GlassCard } from './ui/GlassCard'
import { Tag } from './ui/Tag'
import { useLibraryStore } from '../store/library'
import { useUiStore } from '../store/ui'
import { pickFolders } from '../lib/tauri'

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}

export function HomeView() {
  const stats = useLibraryStore((s) => s.stats)
  const scanning = useLibraryStore((s) => s.scanning)
  const addFolders = useLibraryStore((s) => s.addFolders)
  const setNav = useUiStore((s) => s.setNav)
  const trackCount = stats?.trackCount ?? 0

  const handleAdd = async () => {
    const paths = await pickFolders()
    if (paths.length > 0) {
      await addFolders(paths)
      setNav('library')
    }
  }

  const statusCards = [
    {
      icon: ListMusic,
      title: '已索引曲目',
      desc: stats ? `${stats.trackCount} 首音乐已入库` : '正在读取索引…',
      color: '#4D8DFF',
    },
    {
      icon: Boxes,
      title: '扫描目录',
      desc: stats ? `${stats.folderCount} 个本地目录受监控` : '正在读取索引…',
      color: '#2FE0C8',
    },
    {
      icon: HardDrive,
      title: '音乐时长',
      desc: stats ? `合计 ${formatDuration(stats.totalDurationMs)}` : '正在读取索引…',
      color: '#D8C4FF',
    },
  ]

  return (
    <div className="content home-view">
      <div className="hero">
        <div className="hero-glow" />
        <img className="hero-logo" src="/logo/neptune-symbol.svg" alt="" />
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="pulse" />
            {scanning ? '正在扫描本地音乐' : '本地音乐索引已就绪'}
          </span>
          <h1>{trackCount > 0 ? '让本地音乐重新流动' : '建立你的本地音乐库'}</h1>
          <p>
            {trackCount > 0
              ? `已经为 ${trackCount} 首音乐建立索引，支持全文搜索、排序与文件变化自动同步。`
              : '添加音乐目录后，Neptune 会自动扫描、解析元数据并维持可搜索的本地索引。'}
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => void handleAdd()}>
              <FolderPlus size={16} />
              <span>添加音乐目录</span>
            </button>
            <button className="secondary-btn" onClick={() => setNav('library')}>
              <span>进入音乐库</span>
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="hero-meta">
            <Tag color="#4D8DFF">Tauri 2</Tag>
            <Tag color="#2FE0C8">SQLite FTS5</Tag>
            <Tag color="#D8C4FF">本地优先</Tag>
          </div>
        </div>
      </div>

      <div className="status-grid">
        {statusCards.map((card) => {
          const Icon = card.icon
          return (
            <GlassCard key={card.title}>
              <span className="status-icon" style={{ color: card.color }}>
                <Icon size={20} />
              </span>
              <div>
                <b>{card.title}</b>
                <p>{card.desc}</p>
              </div>
            </GlassCard>
          )
        })}
      </div>

      <GlassCard className="empty-state">
        <span className="empty-icon">
          <FolderPlus size={28} />
        </span>
        <div>
          <h2>{trackCount > 0 ? '音乐库已就绪' : '本地音乐库为空'}</h2>
          <p>
            {trackCount > 0
              ? '曲目已全部收录，接下来可以前往音乐库搜索、排序和查看详情。'
              : '选择本地音乐文件夹，扫描完成后即可在音乐库中浏览全部曲目。'}
          </p>
        </div>
        {trackCount === 0 ? (
          <button className="primary-btn" onClick={() => void handleAdd()}>
            <FolderPlus size={16} />
            <span>添加目录</span>
          </button>
        ) : null}
      </GlassCard>
    </div>
  )
}
