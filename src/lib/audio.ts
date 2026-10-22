import { convertFileSrc, ensureAudioAccess, isTauriRuntime } from './tauri'

export type AudioEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'time'; currentTime: number; duration: number }
  | { type: 'duration'; duration: number }
  | { type: 'ended' }
  | { type: 'error'; message: string }

type AudioListener = (event: AudioEvent) => void

class AudioEngine {
  private audio: HTMLAudioElement | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private listeners = new Set<AudioListener>()
  private currentUrl: string | null = null
  private volume = 0.8

  subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async play(url: string, sourcePath?: string): Promise<void> {
    try {
      const audio = this.ensureElement()
      if (sourcePath && isTauriRuntime()) {
        await ensureAudioAccess(sourcePath)
      }
      const context = this.ensureGraph()
      if (context.state === 'suspended') {
        await context.resume()
      }
      if (this.currentUrl !== url) {
        this.currentUrl = url
        audio.src = url
        audio.load()
      }
      await audio.play()
    } catch (error) {
      this.emit({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async resume(): Promise<void> {
    try {
      const audio = this.ensureElement()
      const context = this.ensureGraph()
      if (context.state === 'suspended') {
        await context.resume()
      }
      await audio.play()
    } catch (error) {
      this.emit({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  pause(): void {
    this.audio?.pause()
  }

  seek(time: number): void {
    if (!this.audio || !Number.isFinite(time)) return
    try {
      this.audio.currentTime = Math.max(0, time)
    } catch {
      // Media not loaded yet; the store keeps the requested time.
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    if (this.audio) {
      this.audio.volume = this.volume
    }
  }

  getFrequencyData(data: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
    this.ensureGraph()
    this.analyser?.getByteFrequencyData(data)
    return data
  }

  private ensureElement(): HTMLAudioElement {
    if (this.audio) return this.audio

    const audio = new Audio()
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    audio.volume = this.volume

    audio.addEventListener('play', () => this.emit({ type: 'play' }))
    audio.addEventListener('pause', () => this.emit({ type: 'pause' }))
    audio.addEventListener('timeupdate', () => {
      if (!Number.isFinite(audio.duration)) return
      this.emit({
        type: 'time',
        currentTime: audio.currentTime,
        duration: audio.duration,
      })
    })
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration)) {
        this.emit({ type: 'duration', duration: audio.duration })
      }
    })
    audio.addEventListener('ended', () => this.emit({ type: 'ended' }))
    audio.addEventListener('error', () => {
      const code = audio.error?.code
      const message =
        audio.error?.message ||
        (code === 4
          ? '无法加载音频：目录未授权或格式不受支持'
          : '无法播放该文件')
      this.emit({
        type: 'error',
        message,
      })
    })

    this.audio = audio
    return audio
  }

  private ensureGraph(): AudioContext {
    if (this.context && this.analyser) return this.context

    const audio = this.ensureElement()
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) {
      throw new Error('当前环境不支持 Web Audio API')
    }

    const context = new AudioCtor()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82

    const source = context.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(context.destination)

    this.context = context
    this.analyser = analyser
    return context
  }

  private emit(event: AudioEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const audioEngine = new AudioEngine()

export function trackSourceUrl(path: string, id: number): string {
  if (isTauriRuntime()) return convertFileSrc(path)
  if (/^(https?:|blob:)/i.test(path)) return path
  if (path.startsWith('/')) return path
  return `/mock/audio-${((id - 1) % 10) + 1}.wav`
}
