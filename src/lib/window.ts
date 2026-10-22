import { getCurrentWindow } from '@tauri-apps/api/window'

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function useWindowActions() {
  if (!isTauriRuntime()) {
    return {
      minimize: () => {},
      toggleMaximize: () => {},
      close: () => {},
    }
  }

  const win = getCurrentWindow()
  return {
    minimize: () => win.minimize(),
    toggleMaximize: () => win.toggleMaximize(),
    close: () => win.close(),
  }
}
