import {
  ArrowLeft,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { trackCoverStyle } from '../lib/cover'
import { coverUrl } from '../lib/tauri'
import { usePlayerStore, type PlayMode } from '../store/player'
import { useUiStore } from '../store/ui'
import { IconButton } from './ui/IconButton'
import { Tag } from './ui/Tag'

const modeOptions: { value: PlayMode; label: string; icon: typeof Repeat }[] = [
  { value: 'order', label: '顺序播放', icon: Repeat },
  { value: 'single', label: '单曲循环', icon: Repeat1 },
  { value: 'shuffle', label: '随机播放', icon: Shuffle },
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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, value))
}

function genreColor(genre: string): string {
  return genrePalette[genre] ?? '#9AA7C4'
}

export function NowPlayingView() {
  const current = usePlayerStore((s) => s.current)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const playMode = usePlayerStore((s) => s.playMode)
  const error = usePlayerStore((s) => s.error)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const seek = usePlayerStore((s) => s.seek)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setPlayMode = usePlayerStore((s) => s.setPlayMode)
  const playContext = usePlayerStore((s) => s.playContext)
  const setNav = useUiStore((s) => s.setNav)

  const progress = duration > 0 ? clamp(currentTime, duration) : 0
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const coverImage = current?.coverPath ? coverUrl(current.coverPath) : ''
  const coverStyle = current
    ? (trackCoverStyle(current.path) as CSSProperties)
    : undefined

  return (
    <div className="content playing-content">
      <div className="now-playing">
        <div className="np-visual">
          <div className="np-backdrop" style={coverStyle} aria-hidden="true" />
          <div className="np-art-frame">
            <div
              className={`np-art ${isPlaying ? 'spinning' : ''}`}
              style={coverStyle}
            >
              {coverImage ? (
                <img src={coverImage} alt="" />
              ) : (
                <Music2 size={74} />
              )}
            </div>
          </div>
          {current ? (
            <div className={`np-equalizer ${isPlaying ? 'playing' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          ) : null}
        </div>

        <section className="np-detail">
          <div className="np-top">
            <IconButton title="返回" aria-label="返回" onClick={() => setNav('home')}>
              <ArrowLeft size={17} />
            </IconButton>
            <span className="np-eyebrow">正在播放</span>
          </div>

          {current ? (
            <>
              <div className="np-title-block">
                <div className="np-title-row">
                  <h1>{current.title}</h1>
                  {isPlaying ? <span className="np-live-dot" title="正在播放" /> : null}
                </div>
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
                    {current.bitrate ? `${Math.round(current.bitrate / 1000)} kbps` : '未知码率'}
                  </span>
                </div>
              </div>

              <div className="np-progress">
                <div className="np-time">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  className="player-slider np-slider"
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={progress}
                  onChange={(event) => seek(Number(event.target.value))}
                  aria-label="播放进度"
                  style={{ '--fill': `${progressPercent}%` } as CSSProperties}
                />
                {error ? <div className="np-error">{error}</div> : null}
              </div>

              <div className="np-controls">
                <IconButton
                  className="np-skip"
                  title="上一首"
                  aria-label="上一首"
                  onClick={previous}
                  disabled={!current}
                >
                  <SkipBack size={20} fill="currentColor" />
                </IconButton>
                <button
                  className="np-play"
                  type="button"
                  title={isPlaying ? '暂停' : '播放'}
                  aria-label={isPlaying ? '暂停' : '播放'}
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause size={22} fill="currentColor" />
                  ) : (
                    <Play size={22} fill="currentColor" className="play-offset" />
                  )}
                </button>
                <IconButton
                  className="np-skip"
                  title="下一首"
                  aria-label="下一首"
                  onClick={next}
                  disabled={!current}
                >
                  <SkipForward size={20} fill="currentColor" />
                </IconButton>
              </div>

              <div className="np-modes" role="group" aria-label="播放模式">
                {modeOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={playMode === option.value ? 'active' : ''}
                      aria-pressed={playMode === option.value}
                      onClick={() => setPlayMode(option.value)}
                    >
                      <Icon size={15} />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="np-volume">
                <IconButton
                  title={volume === 0 ? '取消静音' : '静音'}
                  aria-label={volume === 0 ? '取消静音' : '静音'}
                  onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                >
                  {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </IconButton>
                <input
                  className="volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  aria-label="音量"
                  style={{ '--fill': `${volume * 100}%` } as CSSProperties}
                />
                <span className="np-volume-value">{Math.round(volume * 100)}%</span>
              </div>
            </>
          ) : (
            <div className="np-empty">
              <span className="np-empty-icon">
                <Music2 size={30} />
              </span>
              <h2>未在播放</h2>
              <p>还没有选择歌曲，播放队列会在选择后显示在这里。</p>
              <button className="primary-btn" onClick={() => setNav('library')}>
                前往音乐库
              </button>
            </div>
          )}

          <div className="np-queue">
            <div className="np-queue-head">
              <span>
                <ListMusic size={14} />
                播放队列
              </span>
              <span>{queue.length} 首</span>
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
