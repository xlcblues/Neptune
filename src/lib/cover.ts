import type { CSSProperties } from 'react'

const coverGradients = [
  'linear-gradient(135deg,#4D8DFF,#2B5BE8)',
  'linear-gradient(135deg,#2FE0C8,#1E8E88)',
  'linear-gradient(135deg,#FF7D6B,#FFB36B)',
  'linear-gradient(135deg,#D8C4FF,#8A6CFF)',
  'linear-gradient(135deg,#FF6B9A,#B85CFF)',
  'linear-gradient(135deg,#3D6BFF,#2FE0C8)',
]

function hashIndex(value: string, size: number): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash % size
}

export function trackCoverStyle(path: string): CSSProperties {
  return {
    background: coverGradients[hashIndex(path, coverGradients.length)],
  }
}
