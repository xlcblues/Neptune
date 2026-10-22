import { WindowControls } from './WindowControls'

export function TitleBar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/logo/neptune-symbol.svg" alt="" />
        <span>Neptune</span>
      </div>
      <div className="titlebar-status">
        <span className="status-dot" />
        播放内核 · M2
      </div>
      <WindowControls />
    </header>
  )
}
