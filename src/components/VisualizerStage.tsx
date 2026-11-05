import { useEffect, useRef } from 'react'
import { audioEngine } from '../lib/audio'
import { createRuntime, renderFrame, type VisualOptions } from '../lib/visualizer'
import { coverUrl } from '../lib/tauri'
import { usePlayerStore } from '../store/player'
import { useVisualStore } from '../store/visual'

export function VisualizerStage({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coverRef = useRef<HTMLImageElement | null>(null)
  const coverPath = usePlayerStore((s) => s.current?.coverPath)

  useEffect(() => {
    let cancelled = false
    coverRef.current = null
    if (!coverPath) return
    const image = new Image()
    image.onload = () => {
      if (!cancelled) coverRef.current = image
    }
    image.onerror = () => {
      if (!cancelled) coverRef.current = null
    }
    image.src = coverUrl(coverPath)
    return () => {
      cancelled = true
    }
  }, [coverPath])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const runtime = createRuntime()
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

    resize()
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
        coverRef.current,
        width > 1024
          ? {
              x: width * 0.3,
              y: height * 0.5,
              size: Math.min(width * 0.3, height * 0.62),
            }
          : {
              x: width * 0.5,
              y: height * 0.3,
              size: Math.min(width * 0.44, height * 0.34),
            },
      )
      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="visualizer-canvas" />
    </div>
  )
}
