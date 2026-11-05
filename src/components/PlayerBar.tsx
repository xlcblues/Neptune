import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ChevronUp,
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
  X,
} from 'lucide-react'
import { coverUrl } from '../lib/tauri'
import { trackCoverStyle } from '../lib/cover'
import { usePlayerStore } from '../store/player'
import { useUiStore } from '../store/ui'
import { IconButton } from './ui/IconButton'
import type { PlayMode } from '../store/player'

const modeOptions: Record<PlayMode, { label: string; icon: typeof Repeat }> = {
  order: { label: '顺序播放', icon: Repeat },
  single: { label: '单曲循环', icon: Repeat1 },
  shuffle: { label: '随机播放', icon: Shuffle },
}

const modeOrder: PlayMode[] = ['order', 'single', 'shuffle']

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

export function PlayerBar() {
  const [showQueue, setShowQueue] = useState(false)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const current = usePlayerStore((s) => s.current)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const error = usePlayerStore((s) => s.error)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const seek = usePlayerStore((s) => s.seek)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const playContext = usePlayerStore((s) => s.playContext)
  const playMode = usePlayerStore((s) => s.playMode)
  const setPlayMode = usePlayerStore((s) => s.setPlayMode)
  const setNav = useUiStore((s) => s.setNav)
  const nav = useUiStore((s) => s.nav)

  const track = current
  const progress = duration > 0 ? clamp(currentTime, duration) : 0
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const coverImage = track?.coverPath ? coverUrl(track.coverPath) : ''
  const modeConfig = modeOptions[playMode]
  const ModeIcon = modeConfig.icon

  const cyclePlayMode = () => {
    const currentIndex = modeOrder.indexOf(playMode)
    setPlayMode(modeOrder[(currentIndex + 1) % modeOrder.length])
  }

  return (
    <footer className="player-bar">
      <button
        type="button"
        className="player-now"
        title="打开播放页面"
        aria-label="打开播放页面"
        onClick={() => setNav('playing')}
      >
        <div
          className="player-cover"
          style={track ? trackCoverStyle(track.path) : undefined}
        >
          {coverImage ? <img src={coverImage} alt="" /> : <Music2 size={22} />}
        </div>
        <div className="player-meta">
          {track ? (
            <>
              <b>{track.title}</b>
              <span className={error ? 'is-error' : ''}>
                {error || `${track.artist || '未知艺人'} · ${track.album || '未知专辑'}`}
              </span>
            </>
          ) : (
            <>
              <b>未在播放</b>
              <span>—</span>
            </>
          )}
        </div>
        <span className="player-open-hint" aria-hidden="true">
          <ChevronUp size={15} />
        </span>
      </button>

      <div className="player-center">
        <div className="player-controls">
          <IconButton
            title="上一首"
            aria-label="上一首"
            onClick={previous}
            disabled={!track}
          >
            <SkipBack size={18} fill="currentColor" />
          </IconButton>
          <button
            className="player-play"
            type="button"
            title={isPlaying ? '暂停' : '播放'}
            aria-label={isPlaying ? '暂停' : '播放'}
            onClick={togglePlay}
            disabled={!track}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="play-offset" />
            )}
          </button>
          <IconButton
            title="下一首"
            aria-label="下一首"
            onClick={next}
            disabled={!track}
          >
            <SkipForward size={18} fill="currentColor" />
          </IconButton>
        </div>
        <div className="player-progress">
          <span className="player-time">{formatTime(progress)}</span>
          <input
            className="player-slider"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={progress}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="播放进度"
            disabled={!track}
            style={{ '--fill': `${progressPercent}%` } as CSSProperties}
          />
          <span className="player-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <IconButton
          title={`${modeConfig.label}，点击切换播放模式`}
          aria-label={`播放模式：${modeConfig.label}`}
          aria-pressed={playMode !== 'order'}
          className={`player-mode ${playMode !== 'order' ? 'active' : ''}`}
          onClick={cyclePlayMode}
        >
          <ModeIcon size={16} />
        </IconButton>
        <div className="volume-wrap">
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
        </div>
        {nav !== 'playing' ? (
          <div className="queue-trigger">
            <IconButton
              title={`播放队列（${queue.length}）`}
              aria-label="播放队列"
              aria-pressed={showQueue}
              className={showQueue ? 'active' : ''}
              onClick={() => setShowQueue((visible) => !visible)}
            >
              <ListMusic size={16} />
            </IconButton>
          </div>
        ) : null}
      </div>

      {showQueue && nav !== 'playing' ? (
        <div className="queue-panel glass-card">
          <div className="queue-head">
            <span>播放队列</span>
            <IconButton
              title="关闭队列"
              aria-label="关闭队列"
              onClick={() => setShowQueue(false)}
            >
              <X size={15} />
            </IconButton>
          </div>
          <div className="queue-list">
            {queue.length === 0 ? (
              <div className="queue-empty">队列为空</div>
            ) : (
              queue.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`queue-item ${index === queueIndex ? 'active' : ''}`}
                  onClick={() => void playContext(queue, index)}
                >
                  <span className="queue-index">{index + 1}</span>
                  <span className="queue-meta">
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
      ) : null}
    </footer>
  )
}
