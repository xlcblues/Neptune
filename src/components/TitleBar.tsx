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
        本地索引引擎 · M0
      </div>
      <WindowControls />
    </header>
  )
}
