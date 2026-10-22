const fs = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..', 'public', 'mock')
const sampleRate = 22050
const durationSeconds = 2
const sampleCount = sampleRate * durationSeconds
const segment = Math.floor(sampleRate * 0.25)
const fade = Math.floor(sampleRate * 0.03)
const baseScale = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25]
const ratios = [1, 1.25, 1.5, 2, 1.5, 1.25, 1, 1.5]

function writeWav(filePath, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2)
  }
  fs.writeFileSync(filePath, buffer)
}

fs.mkdirSync(outDir, { recursive: true })

for (let index = 0; index < 10; index += 1) {
  const base = baseScale[index]
  const samples = new Array(sampleCount)
  for (let i = 0; i < sampleCount; i += 1) {
    const step = Math.floor(i / segment)
    const frequency = base * (ratios[step % ratios.length] || 1)
    let value = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.45
    value += Math.sin((2 * Math.PI * frequency * 0.5 * i) / sampleRate) * 0.15
    let gain = 1
    if (i < fade) gain = i / fade
    if (i > sampleCount - fade) gain = Math.max(0, (sampleCount - i) / fade)
    samples[i] = Math.round(Math.max(-1, Math.min(1, value * gain)) * 32767)
  }
  writeWav(path.join(outDir, `audio-${index + 1}.wav`), samples)
}

console.log(`Generated 10 mock WAV files in ${outDir}`)
