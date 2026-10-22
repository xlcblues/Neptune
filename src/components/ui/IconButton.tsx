import type { ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'accent' | 'warm'
}

export function IconButton({ tone = 'default', className = '', ...props }: IconButtonProps) {
  return <button className={`icon-button ${tone} ${className}`} {...props} />
}
