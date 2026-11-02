import { useEffect, useRef, useState } from 'react'
import { Check, Download, Loader2, RefreshCw } from 'lucide-react'
import { WindowControls } from './WindowControls'
import { FALLBACK_VERSION, useUpdater } from '../lib/updater'

export function TitleBar() {
  const { state, checkNow, install } = useUpdater({
    autoCheck: true,
    checkDelay: 2400,
  })
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const currentVersion = state.currentVersion ?? FALLBACK_VERSION
  const busy =
    state.status === 'checking' ||
    state.status === 'downloading' ||
    state.status === 'installing'

  let statusText = '未检查'
  if (state.status === 'checking') {
    statusText = '正在检查更新'
  } else if (state.status === 'latest') {
    statusText = '已是最新版本'
  } else if (state.status === 'available') {
    statusText = `发现新版本 v${state.version ?? ''}`
  } else if (state.status === 'downloading') {
    statusText =
      state.progress && state.progress > 0
        ? `正在下载 ${state.progress}%`
        : '正在下载更新'
  } else if (state.status === 'installing') {
    statusText = '正在安装，完成后自动重启'
  } else if (state.status === 'error') {
    statusText =
      state.message === 'unsupported'
        ? '当前环境不支持在线更新'
        : '检查更新失败'
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const dotClass =
    state.status === 'error'
      ? 'error'
      : state.status === 'available' || state.status === 'downloading'
        ? 'update'
        : state.status === 'installing'
          ? 'installing'
          : ''

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/logo/neptune-symbol.svg" alt="" />
        <span>Neptune</span>
      </div>
      <div className="titlebar-status">
        <span className={`status-dot ${dotClass}`} />
        <span className="updater-version">v{currentVersion}</span>
        <span className="updater-text">{statusText}</span>
        <button
          type="button"
          className="updater-chip"
          title="检查更新"
          aria-label="检查更新"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {state.status === 'checking' ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
        {open ? (
          <div className="updater-popover" ref={panelRef}>
            <div className="updater-pop-head">
              <div className="updater-pop-title">
                <b>Neptune</b>
                <span>v{currentVersion}</span>
              </div>
              <span className={`updater-state ${state.status}`}>{statusText}</span>
            </div>
            {state.status === 'available' && state.body ? (
              <p className="updater-notes">{state.body}</p>
            ) : null}
            {state.status === 'downloading' ? (
              <div
                className={`updater-progress${state.progress ? '' : ' indeterminate'}`}
              >
                <span style={{ width: `${state.progress ?? 38}%` }} />
              </div>
            ) : null}
            {state.status === 'error' && state.message !== 'unsupported' ? (
              <p className="updater-error">{state.message}</p>
            ) : null}
            <div className="updater-actions">
              <button
                type="button"
                className="updater-btn"
                disabled={busy}
                onClick={() => void checkNow()}
              >
                {state.status === 'checking' ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span>{state.status === 'checking' ? '检查中' : '检查更新'}</span>
              </button>
              {state.status === 'available' ? (
                <button
                  type="button"
                  className="updater-btn primary"
                  disabled={busy}
                  onClick={() => void install()}
                >
                  <Download size={14} />
                  <span>下载并安装</span>
                </button>
              ) : null}
              {state.status === 'latest' ? (
                <span className="updater-latest">
                  <Check size={13} />
                  已是最新
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <WindowControls />
    </header>
  )
}
