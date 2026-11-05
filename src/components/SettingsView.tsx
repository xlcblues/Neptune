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
  Settings,
  Timer,
  Waves,
  Wind,
} from 'lucide-react'
import { useVisualStore, type PaletteKey, type VisualPreset } from '../store/visual'
import { IconButton } from './ui/IconButton'
import { VisualizerStage } from './VisualizerStage'

const effectPresets: { key: VisualPreset; icon: typeof Activity; title: string }[] = [
  { key: 'spectrum', icon: Activity, title: '频谱' },
  { key: 'aurora', icon: Wind, title: '极光' },
  { key: 'waveform', icon: Waves, title: '波形' },
  { key: 'vinyl', icon: Disc3, title: '黑胶' },
  { key: 'particles', icon: Orbit, title: '粒子' },
  { key: 'flow', icon: Ribbon, title: '流光' },
]

const effectPalettes: {
  key: PaletteKey
  title: string
  colors: [string, string, string]
}[] = [
  { key: 'ocean', title: '海洋', colors: ['#2f6bff', '#0fa894', '#7c5cff'] },
  { key: 'aurora', title: '极光', colors: ['#0fa894', '#2f6bff', '#8a5cff'] },
  { key: 'rose', title: '玫瑰', colors: ['#cf4a7d', '#cf4a3c', '#8a5cff'] },
  { key: 'mono', title: '单色', colors: ['#101d3d', '#43537c', '#6c7c9d'] },
]

function effectTitle(preset: VisualPreset): string {
  return effectPresets.find((item) => item.key === preset)?.title ?? '频谱'
}

export function SettingsView() {
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
  const resetEffects = useVisualStore((s) => s.reset)

  return (
    <div className="content settings-view">
      <div className="settings-inner">
        <header className="settings-head">
          <span className="settings-eyebrow">
            <Settings size={14} />
            设置
          </span>
          <h1>播放特效</h1>
          <p>播放页的视觉风格与律动参数</p>
        </header>

        <div className="settings-preview" aria-hidden="true">
          <VisualizerStage className="settings-preview-stage" />
          <span className="settings-preview-chip">
            <Activity size={13} />
            {effectTitle(preset)}
          </span>
        </div>

        <section className="settings-group" aria-label="特效类型">
          <div className="settings-group-head">
            <h2>特效类型</h2>
            <span>{effectTitle(preset)}</span>
          </div>
          <div className="settings-preset-grid" role="group" aria-label="播放特效">
            {effectPresets.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`settings-preset ${preset === item.key ? 'active' : ''}`}
                  aria-label={item.title}
                  aria-pressed={preset === item.key}
                  onClick={() => setPreset(item.key)}
                >
                  <Icon size={18} />
                  <span>{item.title}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="settings-group" aria-label="调色板">
          <div className="settings-group-head">
            <h2>调色板</h2>
            <span>
              {effectPalettes.find((item) => item.key === palette)?.title ?? '海洋'}
            </span>
          </div>
          <div className="settings-swatches" role="group" aria-label="调色板">
            {effectPalettes.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`settings-swatch ${palette === item.key ? 'active' : ''}`}
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
        </section>

        <section className="settings-group" aria-label="运动参数">
          <div className="settings-group-head">
            <h2>运动参数</h2>
            <span>强度与速度</span>
          </div>
          <div className="settings-rows">
            <div className="settings-row">
              <span className="settings-row-label">
                <Gauge size={15} />
                强度
              </span>
              <input
                className="settings-slider"
                type="range"
                min={0.4}
                max={1.6}
                step={0.1}
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
                aria-label="强度"
                style={{ '--fill': `${((intensity - 0.4) / 1.2) * 100}%` } as CSSProperties}
              />
              <span className="settings-row-value">{intensity.toFixed(1)}</span>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">
                <Timer size={15} />
                速度
              </span>
              <input
                className="settings-slider"
                type="range"
                min={0.4}
                max={1.6}
                step={0.1}
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                aria-label="速度"
                style={{ '--fill': `${((speed - 0.4) / 1.2) * 100}%` } as CSSProperties}
              />
              <span className="settings-row-value">{speed.toFixed(1)}</span>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">
                <FlipHorizontal2 size={15} />
                镜像
              </span>
              <IconButton
                title={mirror ? '关闭镜像' : '开启镜像'}
                aria-label={mirror ? '关闭镜像' : '开启镜像'}
                aria-pressed={mirror}
                className={`settings-toggle ${mirror ? 'active' : ''}`}
                onClick={() => setMirror(!mirror)}
              >
                <FlipHorizontal2 size={16} />
              </IconButton>
            </div>
          </div>
        </section>

        <div className="settings-footer">
          <button type="button" className="settings-reset" onClick={resetEffects}>
            <RotateCcw size={14} />
            重置默认
          </button>
          <span className="settings-hint">
            <Blend size={13} />
            自动同步到播放页
          </span>
        </div>
      </div>
    </div>
  )
}
