import { Activity, ArrowLeft, ListMusic, Music2 } from 'lucide-react'
import { usePlayerStore } from '../store/player'
import { useVisualStore } from '../store/visual'
import { useUiStore } from '../store/ui'
import { coverUrl } from '../lib/tauri'
import { IconButton } from './ui/IconButton'
import { Tag } from './ui/Tag'
import { VisualizerStage } from './VisualizerStage'

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

function effectTitle(preset: string): string {
  const titles: Record<string, string> = {
    spectrum: '频谱',
    aurora: '极光',
    waveform: '波形',
    vinyl: '黑胶',
    particles: '粒子',
    flow: '流光',
  }
  return titles[preset] ?? '频谱'
}

export function NowPlayingView() {
  const current = usePlayerStore((s) => s.current)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playContext = usePlayerStore((s) => s.playContext)
  const setNav = useUiStore((s) => s.setNav)
  const preset = useVisualStore((s) => s.preset)

  return (
    <div className="content playing-content">
      <div className="now-playing">
        <div className="np-stage-wrap">
          <VisualizerStage className="np-stage-full" />

          <div className="np-stage-label" aria-hidden="true">
            <span className="np-stage-chip">
              <Activity size={13} />
              {effectTitle(preset)}
            </span>
            <span className="np-stage-track">
              <i className={isPlaying ? 'playing' : ''} />
              {current ? current.title : '未在播放'}
            </span>
          </div>

        </div>

        <section className="np-panel" aria-label="播放队列与歌曲信息">
          <div className="np-panel-head">
            <IconButton title="返回" aria-label="返回" onClick={() => setNav('home')}>
              <ArrowLeft size={17} />
            </IconButton>
            <span className="np-eyebrow">
              正在播放
              {isPlaying ? <i className="np-live-dot" /> : null}
            </span>
          </div>

          <div className="np-panel-body">
            {current ? (
              <div className="np-track-head">
                <div className={`np-cover${current.coverPath ? '' : ' fallback'}`}>
                  {current.coverPath ? (
                    <img src={coverUrl(current.coverPath)} alt="" />
                  ) : (
                    <Music2 size={22} />
                  )}
                </div>
                <div className="np-title-block">
                  <h1>{current.title}</h1>
                  <p className="np-artist">
                    {current.artist || '未知艺人'}
                    <span> · </span>
                    {current.album || '未知专辑'}
                  </p>
                  <div className="np-meta-row">
                    {current.genre ? (
                      <Tag color={genreColor(current.genre)}>{current.genre}</Tag>
                    ) : null}
                    <span>{current.year ? `${current.year} 年` : '未知年份'}</span>
                    <span>
                      {current.bitrate
                        ? `${Math.round(current.bitrate / 1000)} kbps`
                        : '未知码率'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="np-empty">
                <span className="np-empty-icon">
                  <Music2 size={28} />
                </span>
                <div>
                  <h2>未在播放</h2>
                  <p>从音乐库选择一首歌，特效会在这里同步律动。</p>
                </div>
                <button
                  className="primary-btn np-empty-btn"
                  type="button"
                  onClick={() => setNav('library')}
                >
                  前往音乐库
                </button>
              </div>
            )}
          </div>

          <div className="np-queue">
            <div className="np-queue-head">
              <span className="np-queue-title">
                <ListMusic size={14} />
                播放队列
              </span>
              <span className="np-queue-count">{queue.length} 首</span>
            </div>
            <div className="np-queue-list">
              {queue.length === 0 ? (
                <div className="np-queue-empty">队列为空</div>
              ) : (
                queue.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`np-queue-item ${index === queueIndex ? 'active' : ''}`}
                    onClick={() => void playContext(queue, index)}
                  >
                    <span className="np-queue-index">{index + 1}</span>
                    <span className="np-queue-meta">
                      <b>{item.title}</b>
                      <span>{item.artist || '未知艺人'}</span>
                    </span>
                    {index === queueIndex && isPlaying ? (
                      <span className="queue-equalizer" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
