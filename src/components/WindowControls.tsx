import { Minus, Square, X } from 'lucide-react'
import { useWindowActions } from '../lib/window'

export function WindowControls() {
  const { minimize, toggleMaximize, close } = useWindowActions()

  return (
    <div className="window-controls">
      <button className="traffic-btn" onClick={minimize} title="最小化" aria-label="最小化">
        <Minus size={12} />
      </button>
      <button className="traffic-btn" onClick={toggleMaximize} title="最大化" aria-label="最大化">
        <Square size={10} />
      </button>
      <button className="traffic-btn danger" onClick={close} title="关闭" aria-label="关闭">
        <X size={12} />
      </button>
    </div>
  )
}
