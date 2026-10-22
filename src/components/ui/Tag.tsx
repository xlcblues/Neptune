import type { ReactNode } from 'react'

interface TagProps {
  children: ReactNode
  color?: string
}

export function Tag({ children, color }: TagProps) {
  return (
    <span className="tag">
      {color ? <span className="tag-dot" style={{ background: color }} /> : null}
      {children}
    </span>
  )
}
