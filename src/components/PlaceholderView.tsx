import { LibraryBig, ListMusic, Sparkles } from 'lucide-react'
import type { NavKey } from '../store/ui'
import { GlassCard } from './ui/GlassCard'
import { Tag } from './ui/Tag'

const content: Record<
  Exclude<NavKey, 'home' | 'playing' | 'settings'>,
  { title: string; milestone: string; desc: string; icon: typeof Sparkles }
> = {
  library: {
    title: '音乐库',
    milestone: 'M1 · 本地索引',
    desc: '目录扫描、元数据解析与 SQLite 全文检索将在 M1 落地，支持搜索、排序与虚拟滚动。',
    icon: LibraryBig,
  },
  classify: {
    title: '智能分类',
    milestone: 'M3 · 多级降级',
    desc: '从本地标签到指纹识别、联网元数据与本地 AI 的分类管线将在 M3 开放。',
    icon: Sparkles,
  },
  playlist: {
    title: '我的歌单',
    milestone: 'M4 · 歌单管理',
    desc: '创建普通与智能歌单，添加、拖拽排序、导出 M3U，并随时编辑曲目与封面。',
    icon: ListMusic,
  },
}

export function PlaceholderView({
  nav,
}: {
  nav: Exclude<NavKey, 'home' | 'playing' | 'settings'>
}) {
  const item = content[nav]
  const Icon = item.icon

  return (
    <div className="content placeholder-view">
      <GlassCard className="placeholder-card">
        <span className="placeholder-icon">
          <Icon size={26} />
        </span>
        <h1>{item.title}</h1>
        <Tag color="#4D8DFF">{item.milestone}</Tag>
        <p>{item.desc}</p>
      </GlassCard>
    </div>
  )
}
