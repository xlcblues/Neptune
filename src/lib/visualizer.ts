import type { PaletteKey, VisualPreset } from '../store/visual'

export type VisualTheme = 'light' | 'dark'

export interface ResolvedPalette {
  backgroundTop: string
  backgroundBottom: string
  colors: string[]
  dim: string
}

export interface VisualOptions {
  preset: VisualPreset
  palette: PaletteKey
  intensity: number
  speed: number
  mirror: boolean
  theme: VisualTheme
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  phase: number
}

export interface VisualRuntime {
  smooth: number[]
  particles: Particle[]
  rotation: number
  phase: number
}

const BIN_COUNT = 64
const PARTICLE_COUNT = 96

const palettes: Record<PaletteKey, { light: ResolvedPalette; dark: ResolvedPalette }> = {
  ocean: {
    light: {
      backgroundTop: '#e9f0fb',
      backgroundBottom: '#dce8ff',
      colors: ['#2f6bff', '#0fa894', '#7c5cff'],
      dim: '#a8c4f7',
    },
    dark: {
      backgroundTop: '#050b17',
      backgroundBottom: '#10214a',
      colors: ['#4d8dff', '#2fe0c8', '#9d8cff'],
      dim: '#23416f',
    },
  },
  aurora: {
    light: {
      backgroundTop: '#e9f7f6',
      backgroundBottom: '#e6edff',
      colors: ['#0fa894', '#2f6bff', '#8a5cff'],
      dim: '#b7e4de',
    },
    dark: {
      backgroundTop: '#07121c',
      backgroundBottom: '#10284f',
      colors: ['#2fe0c8', '#6fc6ff', '#b98aff'],
      dim: '#1e5a68',
    },
  },
  rose: {
    light: {
      backgroundTop: '#fdf0f4',
      backgroundBottom: '#f3e6ff',
      colors: ['#cf4a7d', '#cf4a3c', '#8a5cff'],
      dim: '#f0b9cd',
    },
    dark: {
      backgroundTop: '#190912',
      backgroundBottom: '#3a1430',
      colors: ['#ff6b9a', '#ff7d6b', '#b98aff'],
      dim: '#5d2447',
    },
  },
  mono: {
    light: {
      backgroundTop: '#f3f5fa',
      backgroundBottom: '#e3e8f2',
      colors: ['#101d3d', '#43537c', '#6c7c9d'],
      dim: '#c3cbd9',
    },
    dark: {
      backgroundTop: '#05070d',
      backgroundBottom: '#141a28',
      colors: ['#f2f6ff', '#9aa7c4', '#6c7a9c'],
      dim: '#333d52',
    },
  },
}

export function getPalette(key: PaletteKey, theme: VisualTheme): ResolvedPalette {
  return palettes[key][theme]
}

export function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const number = Number.parseInt(full, 16)
  const r = (number >> 16) & 255
  const g = (number >> 8) & 255
  const b = number & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function smoothValue(target: number, previous: number): number {
  const attack = 1 - Math.exp(-22 * 0.016)
  const release = 1 - Math.exp(-9 * 0.016)
  const factor = target >= previous ? attack : release
  return previous + (target - previous) * clamp(factor, 0, 1)
}

function idleLevel(index: number, time: number): number {
  return (
    0.16 +
    Math.abs(Math.sin(time * 0.7 + index * 0.24)) * 0.28 +
    Math.abs(Math.sin(time * 0.23 + index * 0.11)) * 0.18
  )
}

function averageFrequency(frequency: Uint8Array<ArrayBuffer>): number {
  const count = Math.min(40, frequency.length)
  if (count === 0) return 0
  let sum = 0
  for (let index = 0; index < count; index += 1) sum += frequency[index]
  return sum / count / 255
}

function averageLevel(levels: number[], count = 32): number {
  const size = Math.min(count, levels.length)
  if (size === 0) return 0
  let sum = 0
  for (let index = 0; index < size; index += 1) sum += levels[index]
  return sum / size
}

function resolveLevels(
  frequency: Uint8Array<ArrayBuffer>,
  runtime: VisualRuntime,
  playing: boolean,
  time: number,
  intensity: number,
): number[] {
  const energy = playing ? averageFrequency(frequency) : 0
  const blend = playing ? clamp(energy * 3.2, 0, 1) : 0
  const levels: number[] = []
  for (let index = 0; index < BIN_COUNT; index += 1) {
    const dataValue = index < frequency.length ? frequency[index] / 255 : 0
    const idle = idleLevel(index, time)
    const target = clamp(dataValue * blend + idle * (1 - blend), 0, 1) * intensity
    const previous = runtime.smooth[index]
    const value = smoothValue(target, previous)
    runtime.smooth[index] = value
    levels.push(value)
  }
  return levels
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.32,
    vy: (Math.random() - 0.5) * 0.32,
    size: 1.5 + Math.random() * 4,
    color: '',
    alpha: 0.4 + Math.random() * 0.5,
    phase: index * 0.7,
  }))
}

export function createRuntime(): VisualRuntime {
  return {
    smooth: Array.from({ length: BIN_COUNT }, () => 0),
    particles: createParticles(),
    rotation: 0,
    phase: 0,
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  palette: ResolvedPalette,
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, palette.backgroundTop)
  gradient.addColorStop(1, palette.backgroundBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  levels: number[],
  options: VisualOptions,
  palette: ResolvedPalette,
  width: number,
  height: number,
): void {
  const count = 52
  const gap = Math.max(2, width * 0.006)
  const barWidth = Math.max(2, (width - gap * (count - 1)) / count)
  const maxHeight = height * 0.58
  const baseline = height * 0.84
  ctx.save()
  for (let index = 0; index < count; index += 1) {
    const bin = Math.min(BIN_COUNT - 1, Math.floor((index / count) * BIN_COUNT))
    const level = levels[bin]
    const barHeight = Math.max(3, level * maxHeight)
    const x = index * (barWidth + gap)
    const color = palette.colors[bin % palette.colors.length]
    const radius = Math.min(4, barWidth / 2)
    ctx.fillStyle = rgba(color, 0.92)
    roundedRect(ctx, x, baseline - barHeight, barWidth, barHeight, radius)
    ctx.fill()
    if (options.mirror) {
      const mirroredHeight = Math.max(2, barHeight * 0.62)
      ctx.fillStyle = rgba(color, 0.3)
      roundedRect(
        ctx,
        x,
        height - baseline + (barHeight - mirroredHeight),
        barWidth,
        mirroredHeight,
        radius,
      )
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  levels: number[],
  options: VisualOptions,
  palette: ResolvedPalette,
  width: number,
  height: number,
  time: number,
  runtime: VisualRuntime,
): void {
  const centerY = height * 0.5
  const amplitude = height * 0.3 * options.intensity
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  palette.colors.forEach((color, index) =>
    gradient.addColorStop(index / (palette.colors.length - 1), color),
  )
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, height * 0.012)
  ctx.strokeStyle = gradient
  ctx.shadowColor = rgba(palette.colors[0], 0.5)
  ctx.shadowBlur = 16

  const drawPath = (scale: number, alpha?: number) => {
    ctx.beginPath()
    for (let x = 0; x <= width; x += 2) {
      const bin = Math.min(BIN_COUNT - 1, Math.floor((x / width) * BIN_COUNT))
      const wave =
        Math.sin(time * options.speed * 2 + x * 0.016 + runtime.phase * 2) *
        (0.25 + levels[bin])
      const y = centerY + wave * amplitude * scale
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    if (alpha !== undefined) ctx.globalAlpha = alpha
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  drawPath(1)
  if (options.mirror) drawPath(-0.62, 0.38)
  ctx.restore()
}

function drawAurora(
  ctx: CanvasRenderingContext2D,
  levels: number[],
  options: VisualOptions,
  palette: ResolvedPalette,
  width: number,
  height: number,
  time: number,
  runtime: VisualRuntime,
): void {
  const centerY = height * 0.5
  const layers = 4
  ctx.save()
  for (let layer = 0; layer < layers; layer += 1) {
    const offset = (layer - (layers - 1) / 2) * height * 0.15
    const color = palette.colors[layer % palette.colors.length]
    ctx.beginPath()
    for (let x = 0; x <= width; x += 3) {
      const bin = Math.min(BIN_COUNT - 1, Math.floor((x / width) * BIN_COUNT))
      const drift =
        Math.sin(x * 0.011 + runtime.phase + layer * 1.6 + time * options.speed * 0.15) *
        height *
        0.1
      const audio = (levels[bin] - 0.5) * height * (0.2 + layer * 0.05)
      const y = centerY + offset + drift + audio
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineCap = 'round'
    ctx.lineWidth = height * (0.045 + layer * 0.032)
    ctx.strokeStyle = rgba(color, 0.14 + layer * 0.035)
    ctx.shadowColor = rgba(color, 0.45)
    ctx.shadowBlur = 18
    ctx.stroke()
    if (options.mirror) {
      ctx.save()
      ctx.translate(0, height)
      ctx.scale(1, -1)
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = rgba(color, 0.1)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.restore()
}

function drawVinyl(
  ctx: CanvasRenderingContext2D,
  levels: number[],
  options: VisualOptions,
  palette: ResolvedPalette,
  width: number,
  height: number,
  dt: number,
  runtime: VisualRuntime,
  cover: HTMLImageElement | null,
): void {
  const energy = averageLevel(levels, 48)
  const discSize = Math.min(width * 0.46, height * 0.7)
  const centerX = width * 0.5
  const centerY = height * 0.5
  const coverSize = discSize * (0.52 + options.intensity * 0.1)
  const spin = options.speed * (0.35 + energy * 1.4)
  runtime.rotation += dt * spin * (options.mirror ? -1 : 1)

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(runtime.rotation)

  const discGradient = ctx.createRadialGradient(0, 0, discSize * 0.04, 0, 0, discSize * 0.5)
  discGradient.addColorStop(0, '#2a3040')
  discGradient.addColorStop(0.72, '#10141f')
  discGradient.addColorStop(1, '#05070c')
  ctx.fillStyle = discGradient
  ctx.beginPath()
  ctx.arc(0, 0, discSize * 0.5, 0, Math.PI * 2)
  ctx.fill()

  const grooves = 16
  for (let index = 0; index < grooves; index += 1) {
    const radius = discSize * (0.24 + (index / grooves) * 0.23)
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.strokeStyle = index % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.globalAlpha = 0.12 + energy * 0.24
  ctx.fillStyle = palette.colors[0]
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, discSize * 0.47, -0.45, 0.25 + energy * 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.save()
  if (cover && cover.complete && cover.naturalWidth > 0) {
    roundedRect(ctx, -coverSize / 2, -coverSize / 2, coverSize, coverSize, coverSize * 0.05)
    ctx.clip()
    ctx.drawImage(cover, -coverSize / 2, -coverSize / 2, coverSize, coverSize)
  } else {
    const fallback = ctx.createLinearGradient(
      -coverSize / 2,
      -coverSize / 2,
      coverSize / 2,
      coverSize / 2,
    )
    fallback.addColorStop(0, palette.colors[0])
    fallback.addColorStop(1, palette.colors[2])
    ctx.fillStyle = fallback
    roundedRect(ctx, -coverSize / 2, -coverSize / 2, coverSize, coverSize, coverSize * 0.05)
    ctx.fill()
    ctx.fillStyle = rgba(palette.dim, 0.35)
    ctx.beginPath()
    ctx.arc(0, 0, coverSize * 0.34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = rgba(palette.colors[1], 0.8)
    ctx.beginPath()
    ctx.arc(0, 0, coverSize * 0.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  ctx.fillStyle = '#f5f7ff'
  ctx.beginPath()
  ctx.arc(0, 0, discSize * 0.022, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = rgba(palette.colors[1], 0.32 + energy * 0.45)
  ctx.lineWidth = 2 + energy * 6
  ctx.shadowColor = palette.colors[1]
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(centerX, centerY, discSize * 0.56 + Math.sin(runtime.phase * 2) * 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = rgba(palette.colors[0], 0.92)
  ctx.lineWidth = Math.max(2, height * 0.005)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(centerX - discSize * 0.66, centerY - discSize * 0.52)
  ctx.quadraticCurveTo(
    centerX - discSize * 0.34,
    centerY - discSize * 0.24,
    centerX + discSize * 0.08,
    centerY - discSize * 0.05,
  )
  ctx.stroke()
  ctx.restore()
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  levels: number[],
  options: VisualOptions,
  palette: ResolvedPalette,
  width: number,
  height: number,
  dt: number,
  time: number,
  runtime: VisualRuntime,
  theme: VisualTheme,
): void {
  const energy = averageLevel(levels, 48)
  const count = Math.round(PARTICLE_COUNT * (0.42 + options.intensity * 0.52))
  const baseSpeed = options.speed * (0.14 + energy * 1.1)
  const alphaBase = theme === 'light' ? 0.68 : 0.88
  ctx.save()

  for (let index = 0; index < count; index += 1) {
    const particle = runtime.particles[index]
    if (!particle.color) {
      particle.color = palette.colors[index % palette.colors.length]
    }
    const targetVx = (particle.x - 0.5) * 1.4
    const targetVy = (particle.y - 0.5) * 1.4
    const ease = Math.min(1, dt * 1.6)
    particle.vx += (targetVx - particle.vx) * ease
    particle.vy += (targetVy - particle.vy) * ease
    particle.x += particle.vx * baseSpeed
    particle.y += particle.vy * baseSpeed
    if (particle.x < -0.08) particle.x = 1.08
    if (particle.x > 1.08) particle.x = -0.08
    if (particle.y < -0.08) particle.y = 1.08
    if (particle.y > 1.08) particle.y = -0.08

    const pulse = 0.72 + Math.sin(time * 2.1 + particle.phase) * 0.28
    const size = particle.size * (0.62 + energy * 0.72) * (0.75 + options.intensity * 0.25)
    ctx.fillStyle = rgba(particle.color, alphaBase * pulse * (0.34 + energy * 0.58))
    ctx.shadowColor = particle.color
    ctx.shadowBlur = 5 + energy * 16
    ctx.beginPath()
    ctx.arc(particle.x * width, particle.y * height, size, 0, Math.PI * 2)
    ctx.fill()

    if (options.mirror) {
      ctx.fillStyle = rgba(particle.color, alphaBase * pulse * 0.22)
      ctx.beginPath()
      ctx.arc(particle.x * width, height - particle.y * height, size * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()

  if (energy > 0.16) {
    const links = Math.min(34, Math.round(18 + energy * 90))
    ctx.save()
    ctx.lineWidth = Math.max(1, height * 0.002)
    for (let link = 0; link < links; link += 1) {
      const a = runtime.particles[link % count]
      const b = runtime.particles[(link + 5) % count]
      const dx = (a.x - b.x) * width
      const dy = (a.y - b.y) * height
      const distance = Math.sqrt(dx * dx + dy * dy)
      const maxDistance = Math.min(width, height) * (0.12 + energy * 0.16)
      if (distance < maxDistance) {
        ctx.strokeStyle = rgba(
          palette.colors[link % palette.colors.length],
          (1 - distance / maxDistance) * 0.34,
        )
        ctx.beginPath()
        ctx.moveTo(a.x * width, a.y * height)
        ctx.lineTo(b.x * width, b.y * height)
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}

function drawFlow(
  ctx: CanvasRenderingContext2D,
  levels: number[],
  options: VisualOptions,
  palette: ResolvedPalette,
  width: number,
  height: number,
  time: number,
  runtime: VisualRuntime,
): void {
  const energy = averageLevel(levels, 48)
  const bands = 6
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let band = 0; band < bands; band += 1) {
    const bandY = height * (0.16 + (band / (bands - 1)) * 0.66)
    const color = palette.colors[band % palette.colors.length]
    ctx.beginPath()
    for (let x = 0; x <= width; x += 3) {
      const bin = Math.min(BIN_COUNT - 1, Math.floor((x / width) * BIN_COUNT))
      const sway = Math.sin(time * options.speed * 0.8 + x * 0.007 + band * 1.2)
      const pulse = Math.sin(x * 0.009 + runtime.phase * (0.7 + band * 0.12))
      const audio = (levels[bin] - 0.42) * height * (0.07 + energy * 0.07)
      const y = bandY + sway * height * 0.045 + pulse * height * 0.024 + audio
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineWidth = Math.max(2, height * (0.012 + band * 0.004) * options.intensity)
    ctx.strokeStyle = rgba(color, 0.5)
    ctx.shadowColor = color
    ctx.shadowBlur = 10 + energy * 22
    ctx.stroke()
    if (options.mirror) {
      ctx.save()
      ctx.translate(0, height)
      ctx.scale(1, -1)
      ctx.globalAlpha = 0.3
      ctx.strokeStyle = rgba(color, 0.22)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.restore()
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  options: VisualOptions,
  runtime: VisualRuntime,
  frequency: Uint8Array<ArrayBuffer>,
  playing: boolean,
  width: number,
  height: number,
  time: number,
  dt: number,
  cover: HTMLImageElement | null,
): void {
  const palette = getPalette(options.palette, options.theme)
  runtime.phase += dt * options.speed
  const levels = resolveLevels(frequency, runtime, playing, time, options.intensity)
  drawBackground(ctx, palette, width, height)

  switch (options.preset) {
    case 'spectrum':
      drawSpectrum(ctx, levels, options, palette, width, height)
      break
    case 'waveform':
      drawWaveform(ctx, levels, options, palette, width, height, time, runtime)
      break
    case 'aurora':
      drawAurora(ctx, levels, options, palette, width, height, time, runtime)
      break
    case 'vinyl':
      drawVinyl(ctx, levels, options, palette, width, height, dt, runtime, cover)
      break
    case 'particles':
      drawParticles(ctx, levels, options, palette, width, height, dt, time, runtime, options.theme)
      break
    case 'flow':
      drawFlow(ctx, levels, options, palette, width, height, time, runtime)
      break
  }
}
