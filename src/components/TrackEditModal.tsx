import { useState } from 'react'
import { Image as ImageIcon, Loader2, Trash2, X } from 'lucide-react'
import type { Track } from '../types/track'
import { coverUrl, pickImage } from '../lib/tauri'
import { trackCoverStyle } from '../lib/cover'
import { IconButton } from './ui/IconButton'

interface TrackEditModalProps {
  track: Track
  onClose: () => void
  onSave: (patch: {
    title: string
    artist: string
    album: string
    genre: string
  }) => Promise<void>
  onCoverChange: (coverPath: string | null) => Promise<void>
}

export function TrackEditModal({
  track,
  onClose,
  onSave,
  onCoverChange,
}: TrackEditModalProps) {
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist || '')
  const [album, setAlbum] = useState(track.album || '')
  const [genre, setGenre] = useState(track.genre || '')
  const [busy, setBusy] = useState(false)
  const url = coverUrl(track.coverPath)

  const handleSave = async () => {
    if (!title.trim()) return
    setBusy(true)
    await onSave({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim(),
      genre: genre.trim(),
    })
    setBusy(false)
    onClose()
  }

  const handlePickCover = async () => {
    const path = await pickImage()
    if (path === null) return
    setBusy(true)
    await onCoverChange(path)
    setBusy(false)
    onClose()
  }

  const handleRemoveCover = async () => {
    if (!track.coverPath) return
    setBusy(true)
    await onCoverChange(null)
    setBusy(false)
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal glass-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>编辑曲目</h2>
          <IconButton title="关闭" aria-label="关闭编辑曲目" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="track-edit-layout">
          <div className="modal-cover" style={trackCoverStyle(track.path)}>
            {url ? <img src={url} alt="" /> : <MusicPlaceholder />}
            <div className="modal-cover-actions">
              <button type="button" onClick={() => void handlePickCover()} disabled={busy}>
                <ImageIcon size={13} />
                <span>选择</span>
              </button>
              {track.coverPath ? (
                <button
                  type="button"
                  className="danger"
                  onClick={() => void handleRemoveCover()}
                  disabled={busy}
                >
                  <Trash2 size={13} />
                  <span>移除</span>
                </button>
              ) : null}
            </div>
          </div>
          <div className="form-grid track-edit-fields">
            <div className="field full">
              <label htmlFor="track-title">标题</label>
              <input
                id="track-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="track-artist">艺人</label>
              <input
                id="track-artist"
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="track-album">专辑</label>
              <input
                id="track-album"
                value={album}
                onChange={(event) => setAlbum(event.target.value)}
              />
            </div>
            <div className="field full">
              <label htmlFor="track-genre">流派</label>
              <input
                id="track-genre"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                placeholder="例如：电子、爵士、古典"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleSave()}
            disabled={busy || !title.trim()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : null}
            <span>保存</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function MusicPlaceholder() {
  return (
    <span className="modal-cover-icon">
      <ImageIcon size={26} />
    </span>
  )
}
