import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import {
  Activity,
  Blend,
  Disc3,
  FlipHorizontal2,
  Gauge,
  Orbit,
  Ribbon,
  RotateCcw,
  Timer,
  Waves,
  Wind,
} from 'lucide-react'
import { audioEngine } from '../lib/audio'
import { trackCoverStyle } from '../lib/cover'
import { coverUrl } from '../lib/tauri'
import { createRuntime, renderFrame, type VisualOptions } from '../lib/visualizer'
import { usePlayerStore } from '../store/player'
import { useVisualStore, type PaletteKey, type VisualPreset } from '../store/visual'
import { IconButton } from './ui/IconButton'

const presets: { key: VisualPreset; icon: typeof Activity; title: string }[] = [
  { key: 'spectrum', icon: Activity, title: '频谱' },
  { key: 'aurora', icon: Wind, title: '极光' },
  { key: 'waveform', icon: Waves, title: '波形' },
  { key: 'vinyl', icon: Disc3, title: '黑胶' },
  { key: 'particles', icon: Orbit, title: '粒子' },
  { key: 'flow', icon: Ribbon, title: '流光' },
]

const palettes: { key: PaletteKey; title: string; colors: [string, string, string] }[] = [
  { key: 'ocean', title: '海洋', colors: ['#2f6bff', '#0fa894', '#7c5cff'] },
  { key: 'aurora', title: '极光', colors: ['#0fa894', '#2f6bff', '#8a5cff'] },
  { key: 'rose', title: '玫瑰', colors: ['#cf4a7d', '#cf4a3c', '#8a5cff'] },
  { key: 'mono', title: '单色', colors: ['#101d3d', '#43537c', '#6c7c9d'] },
]

export function VisualView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const preset = useVisualStore((s) => s.preset)
  const palette = useVisualStore((s) => s.palette)
  const intensity = useVisualStore((s) => s.intensity)
  const speed = useVisualStore((s) => s.speed)
  const mirror = useVisualStore((s) => s.mirror)
  const setPreset = useVisualStore((s) => s.setPreset)
  const setPalette = useVisualStore((s) => s.setPalette)
  const setIntensity = useVisualStore((s) => s.setIntensity)
  const setSpeed = useVisualStore((s) => s.setSpeed)
  const setMirror = useVisualStore((s) => s.setMirror)
  const reset = useVisualStore((s) => s.reset)
  const current = usePlayerStore((s) => s.current)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const runtime = createRuntime()
    let coverImage: HTMLImageElement | null = null
    let coverPath: string | null = null
    let width = 0
    let height = 0
    let rafId = 0
    let last = performance.now()

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = Math.max(1, host.clientWidth)
      height = Math.max(1, host.clientHeight)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const loadCover = () => {
      const track = usePlayerStore.getState().current
      const next = track?.coverPath ? coverUrl(track.coverPath) : null
      if (next === coverPath) return
      coverPath = next
      coverImage = null
      if (!next) return
      const image = new Image()
      image.onload = () => {
        coverImage = image
      }
      image.onerror = () => {
        coverImage = null
      }
      image.src = next
    }

    resize()
    loadCover()

    const observer = new ResizeObserver(resize)
    observer.observe(host)

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const settings = useVisualStore.getState()
      const options: VisualOptions = {
        preset: settings.preset,
        palette: settings.palette,
        intensity: settings.intensity,
        speed: settings.speed,
        mirror: settings.mirror,
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      }
      const frequency = new Uint8Array(128)
      audioEngine.getFrequencyData(frequency)
      renderFrame(
        ctx,
        options,
        runtime,
        frequency,
        usePlayerStore.getState().isPlaying,
        width,
        height,
        now / 1000,
        dt,
        coverImage,
      )
      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [])

  const cover = current?.coverPath ? coverUrl(current.coverPath) : ''

  return (
    <div className="visual-view" ref={hostRef}>
      <canvas ref={canvasRef} className="visual-canvas" aria-label="播放特效" />
      <aside className="visual-panel">
        <div className="visual-now">
          <div
            className="visual-cover"
            style={current ? trackCoverStyle(current.path) : undefined}
          >
            {cover ? <img src={cover} alt="" /> : <Activity size={16} />}
          </div>
          <div className="visual-meta">
            <b>{current?.title ?? '未在播放'}</b>
            <span className={isPlaying ? 'playing' : ''}>
              {current
                ? `${current.artist || '未知艺人'} · ${isPlaying ? '播放中' : '已暂停'}`
                : '选择一首音乐开始'}
            </span>
          </div>
        </div>

        <div className="visual-presets" role="group" aria-label="播放特效">
          {presets.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={`visual-preset ${preset === item.key ? 'active' : ''}`}
                title={item.title}
                aria-label={item.title}
                aria-pressed={preset === item.key}
                onClick={() => setPreset(item.key)}
              >
                <Icon size={17} />
              </button>
            )
          })}
        </div>

        <div className="visual-swatches" role="group" aria-label="调色板">
          <span className="visual-swatch-label">
            <Blend size={15} />
          </span>
          {palettes.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`visual-swatch ${palette === item.key ? 'active' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[2]})`,
              }}
              title={item.title}
              aria-label={item.title}
              aria-pressed={palette === item.key}
              onClick={() => setPalette(item.key)}
            />
          ))}
        </div>

        <div className="visual-range-row">
          <Gauge size={15} aria-hidden="true" />
          <input
            className="visual-slider"
            type="range"
            min={0.4}
            max={1.6}
            step={0.1}
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
            aria-label="强度"
            style={{ '--fill': `${((intensity - 0.4) / 1.2) * 100}%` } as CSSProperties}
          />
        </div>
        <div className="visual-range-row">
          <Timer size={15} aria-hidden="true" />
          <input
            className="visual-slider"
            type="range"
            min={0.4}
            max={1.6}
            step={0.1}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            aria-label="速度"
            style={{ '--fill': `${((speed - 0.4) / 1.2) * 100}%` } as CSSProperties}
          />
        </div>

        <div className="visual-actions">
          <IconButton
            title={mirror ? '关闭镜像' : '开启镜像'}
            aria-label={mirror ? '关闭镜像' : '开启镜像'}
            aria-pressed={mirror}
            className={mirror ? 'active' : ''}
            onClick={() => setMirror(!mirror)}
          >
            <FlipHorizontal2 size={16} />
          </IconButton>
          <IconButton title="重置" aria-label="重置" onClick={reset}>
            <RotateCcw size={16} />
          </IconButton>
        </div>
      </aside>
    </div>
  )
}
