import { useEffect, useMemo } from 'react'
import {
  BadgeCheck,
  Check,
  CircleHelp,
  Globe,
  ListMusic,
  Loader2,
  Music2,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from 'lucide-react'
import type { ClassificationItem } from '../types/track'
import { isTauriRuntime, onClassifyProgress } from '../lib/tauri'
import { useClassifyStore, type ClassifyFilter } from '../store/classify'
import { IconButton } from './ui/IconButton'
import { Tag } from './ui/Tag'
import { GlassCard } from './ui/GlassCard'

const filterOptions: { key: ClassifyFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'unclassified', label: '未识别' },
  { key: 'classified', label: '已确认' },
]

const sourceMeta: Record<string, { label: string; color: string }> = {
  metadata: { label: '文件标签', color: '#4D8DFF' },
  local: { label: '本地推断', color: '#2FE0C8' },
  network: { label: 'MusicBrainz', color: '#D8C4FF' },
  manual: { label: '手动设置', color: '#FFC978' },
}

const statIcons: Record<string, typeof ListMusic> = {
  all: ListMusic,
  classified: BadgeCheck,
  pending: ScanSearch,
  unclassified: CircleHelp,
}

function confidenceText(confidence: number | null): string {
  if (confidence == null) return '—'
  return `${Math.round(confidence * 100)}%`
}

function ClassifyRow({
  item,
  selected,
  onToggle,
  onApply,
}: {
  item: ClassificationItem
  selected: boolean
  onToggle: () => void
  onApply: (id: number, genre: string) => void
}) {
  const source = item.source ? sourceMeta[item.source] : null
  const suggested = item.suggestedGenre ?? ''
  const hasSuggestion = Boolean(suggested)
  return (
    <div className={`classify-row ${selected ? 'selected' : ''}`}>
      <label className="row-check">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`选择 ${item.title}`}
        />
      </label>
      <div className="row-track">
        <b>{item.title}</b>
        <span>
          {item.artist || '未知艺人'}
          {item.album ? ` · ${item.album}` : ''}
        </span>
      </div>
      <div className="row-current">
        {item.currentGenre ? <Tag>{item.currentGenre}</Tag> : <span className="row-empty">未分类</span>}
      </div>
      <div className="row-suggested">
        {hasSuggestion ? <span className="suggested-genre">{suggested}</span> : <span className="row-empty">待识别</span>}
      </div>
      <div className="row-source">
        {source ? <Tag color={source.color}>{source.label}</Tag> : <span className="row-empty">—</span>}
      </div>
      <div className="row-confidence">{confidenceText(item.confidence)}</div>
      <div className="row-action">
        <button
          type="button"
          className="apply-btn"
          disabled={!hasSuggestion}
          onClick={() => hasSuggestion && onApply(item.id, suggested)}
        >
          <Check size={14} />
          <span>采用</span>
        </button>
      </div>
    </div>
  )
}

export function ClassifyView() {
  const items = useClassifyStore((s) => s.items)
  const stats = useClassifyStore((s) => s.stats)
  const filter = useClassifyStore((s) => s.filter)
  const loading = useClassifyStore((s) => s.loading)
  const running = useClassifyStore((s) => s.running)
  const useNetwork = useClassifyStore((s) => s.useNetwork)
  const progress = useClassifyStore((s) => s.progress)
  const error = useClassifyStore((s) => s.error)
  const selectedIds = useClassifyStore((s) => s.selectedIds)
  const setFilter = useClassifyStore((s) => s.setFilter)
  const setUseNetwork = useClassifyStore((s) => s.setUseNetwork)
  const refresh = useClassifyStore((s) => s.refresh)
  const startAll = useClassifyStore((s) => s.startAll)
  const retrySelected = useClassifyStore((s) => s.retrySelected)
  const toggleSelect = useClassifyStore((s) => s.toggleSelect)
  const toggleSelectAll = useClassifyStore((s) => s.toggleSelectAll)
  const clearSelection = useClassifyStore((s) => s.clearSelection)
  const applySuggestion = useClassifyStore((s) => s.applySuggestion)
  const applySelectedSuggestions = useClassifyStore((s) => s.applySelectedSuggestions)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    onClassifyProgress((next) => {
      useClassifyStore.setState({
        running: next.status === 'running',
        progress: next,
      })
      if (next.status === 'done' || next.status === 'error') {
        window.setTimeout(() => {
          useClassifyStore.setState({ running: false, progress: null })
          void useClassifyStore.getState().refresh()
        }, 500)
      }
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  const filterCounts = useMemo(
    () => ({
      all: stats?.total ?? 0,
      pending: stats?.pending ?? 0,
      unclassified: stats?.unclassified ?? 0,
      classified: stats?.classified ?? 0,
    }),
    [stats],
  )

  const sourceRows = useMemo(() => {
    if (!stats) return []
    return ['metadata', 'local', 'network', 'manual']
      .filter((key) => (stats.sourceCounts?.[key] ?? 0) > 0)
      .map((key) => ({
        key,
        count: stats.sourceCounts?.[key] ?? 0,
        meta: sourceMeta[key],
      }))
  }, [stats])

  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id))
  const selectedCount = selectedIds.length
  const selectedWithSuggestion = items.filter(
    (item) => selectedIds.includes(item.id) && item.suggestedGenre,
  ).length

  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0

  const statCards = [
    { key: 'all', title: '全部曲目', value: filterCounts.all },
    { key: 'classified', title: '已确认', value: filterCounts.classified },
    { key: 'pending', title: '待确认', value: filterCounts.pending },
    { key: 'unclassified', title: '未识别', value: filterCounts.unclassified },
  ]

  return (
    <div className="content classify-view">
      <header className="classify-head">
        <div>
          <div className="classify-title-row">
            <h1>智能分类</h1>
            {!isTauriRuntime() && <Tag color="#D8C4FF">浏览器预览</Tag>}
          </div>
          <p className="classify-sub">
            {stats ? `共 ${stats.total} 首 · 已确认 ${stats.classified} · 待确认 ${stats.pending}` : '正在读取分类状态…'}
          </p>
        </div>
        <div className="classify-actions">
          <label className="network-toggle" title="允许联网识别">
            <input
              type="checkbox"
              checked={useNetwork}
              onChange={(event) => setUseNetwork(event.target.checked)}
            />
            <span className="toggle-track">
              <i />
            </span>
            <Globe size={15} />
            <span className="toggle-label">允许联网识别</span>
          </label>
          <IconButton
            title="刷新"
            aria-label="刷新分类状态"
            onClick={() => void refresh()}
            disabled={loading}
            className={loading ? 'is-busy' : ''}
          >
            <RefreshCw size={16} />
          </IconButton>
          <button
            className="primary-btn"
            onClick={() => void startAll()}
            disabled={running || !stats || stats.total === 0}
          >
            <Sparkles size={16} />
            <span>开始检测</span>
          </button>
        </div>
      </header>

      <section className="classify-stats">
        {statCards.map((card) => {
          const Icon = statIcons[card.key]
          return (
            <GlassCard key={card.key} className="classify-stat">
              <span className="classify-stat-icon">
                <Icon size={19} />
              </span>
              <div className="classify-stat-meta">
                <b>{card.value}</b>
                <span>{card.title}</span>
              </div>
            </GlassCard>
          )
        })}
      </section>

      <GlassCard className="source-card">
        <div className="source-head">
          <span className="source-title">
            <Tags size={14} />
            来源分布
          </span>
          <span className="source-total">{sourceRows.reduce((sum, row) => sum + row.count, 0)} 条建议</span>
        </div>
        <div className="source-chips">
          {sourceRows.length === 0 ? (
            <span className="row-empty">暂无识别建议</span>
          ) : (
            sourceRows.map((row) => (
              <Tag key={row.key} color={row.meta.color}>
                {row.meta.label} {row.count}
              </Tag>
            ))
          )}
        </div>
      </GlassCard>

      {running || progress ? (
        <div className="classify-progress">
          <div className="progress-copy">
            <Loader2 size={15} className="spin" />
            <div>
              <b>{progress?.message ?? '正在分类…'}</b>
              <span>{progress ? `${progress.found} 首已获得建议` : '准备中'}</span>
            </div>
          </div>
          <div className="progress-track">
            <i style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="progress-count">
            {progress ? `${progress.current}/${progress.total}` : '—'}
          </span>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="classify-panel">
        <div className="classify-toolbar">
          <div className="filter-segmented" role="group" aria-label="筛选状态">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={filter === option.key ? 'active' : ''}
                onClick={() => setFilter(option.key)}
              >
                {option.label}
                <span>{filterCounts[option.key]}</span>
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            {selectedCount > 0 ? (
              <>
                <span className="selection-count">已选 {selectedCount} 首</span>
                <button
                  className="secondary-btn"
                  onClick={() => void applySelectedSuggestions()}
                  disabled={selectedWithSuggestion === 0}
                >
                  <Check size={15} />
                  <span>采用选中建议</span>
                </button>
                <button
                  className="text-btn"
                  onClick={() => void retrySelected()}
                  disabled={running}
                >
                  重新检测选中
                </button>
                <IconButton title="清除选择" aria-label="清除选择" onClick={clearSelection}>
                  <X size={14} />
                </IconButton>
              </>
            ) : null}
          </div>
        </div>

        <div className="classify-table">
          <div className="classify-table-head">
            <label className="row-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="选择全部"
              />
            </label>
            <span className="head-track">曲目</span>
            <span className="head-current">当前流派</span>
            <span className="head-suggested">建议流派</span>
            <span className="head-source">来源</span>
            <span className="head-confidence">置信度</span>
            <span className="head-action" />
          </div>
          {items.length === 0 && !loading ? (
            <div className="classify-empty">
              <span className="empty-icon">
                <Music2 size={24} />
              </span>
              <h2>{filter === 'all' ? '还没有曲目' : '当前筛选下没有曲目'}</h2>
              <p>
                {filter === 'all'
                  ? '添加音乐目录后即可开始智能分类。'
                  : '切换到全部查看完整列表。'}
              </p>
            </div>
          ) : (
            <div className="classify-rows">
              {items.map((item) => (
                <ClassifyRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onToggle={() => toggleSelect(item.id)}
                  onApply={(id, genre) => void applySuggestion(id, genre)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="classify-note">
        <ShieldCheck size={14} />
        <span>联网识别仅向 MusicBrainz 查询公开标签，本地音频文件不会上传。</span>
      </footer>
    </div>
  )
}
