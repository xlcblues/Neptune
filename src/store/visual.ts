import { create } from 'zustand'

export type VisualPreset =
  | 'spectrum'
  | 'aurora'
  | 'waveform'
  | 'vinyl'
  | 'particles'
  | 'flow'

export type PaletteKey = 'ocean' | 'aurora' | 'rose' | 'mono'

const STORAGE_KEY = 'neptune.visual'
const PRESETS: VisualPreset[] = ['spectrum', 'aurora', 'waveform', 'vinyl', 'particles', 'flow']
const PALETTES: PaletteKey[] = ['ocean', 'aurora', 'rose', 'mono']

interface VisualSettings {
  preset: VisualPreset
  palette: PaletteKey
  intensity: number
  speed: number
  mirror: boolean
}

interface VisualState extends VisualSettings {
  setPreset: (preset: VisualPreset) => void
  setPalette: (palette: PaletteKey) => void
  setIntensity: (value: number) => void
  setSpeed: (value: number) => void
  setMirror: (mirror: boolean) => void
  reset: () => void
}

const defaults: VisualSettings = {
  preset: 'spectrum',
  palette: 'ocean',
  intensity: 1,
  speed: 1,
  mirror: false,
}

function clampValue(value: unknown, min: number, max: number): number {
  const number = typeof value === 'number' ? value : NaN
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

function readSettings(): VisualSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<VisualSettings>
    return {
      preset: PRESETS.includes(parsed.preset as VisualPreset)
        ? (parsed.preset as VisualPreset)
        : defaults.preset,
      palette: PALETTES.includes(parsed.palette as PaletteKey)
        ? (parsed.palette as PaletteKey)
        : defaults.palette,
      intensity: clampValue(parsed.intensity, 0.4, 1.6),
      speed: clampValue(parsed.speed, 0.4, 1.6),
      mirror: Boolean(parsed.mirror),
    }
  } catch {
    return defaults
  }
}

function persist(patch: Partial<VisualSettings>): void {
  const current = useVisualStore.getState()
  const settings: VisualSettings = {
    preset: patch.preset ?? current.preset,
    palette: patch.palette ?? current.palette,
    intensity: patch.intensity ?? current.intensity,
    speed: patch.speed ?? current.speed,
    mirror: patch.mirror ?? current.mirror,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const useVisualStore = create<VisualState>((set) => ({
  ...readSettings(),
  setPreset: (preset) => {
    set({ preset })
    persist({ preset })
  },
  setPalette: (palette) => {
    set({ palette })
    persist({ palette })
  },
  setIntensity: (intensity) => {
    set({ intensity })
    persist({ intensity })
  },
  setSpeed: (speed) => {
    set({ speed })
    persist({ speed })
  },
  setMirror: (mirror) => {
    set({ mirror })
    persist({ mirror })
  },
  reset: () => {
    set(defaults)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  },
}))
