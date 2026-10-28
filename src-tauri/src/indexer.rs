use crate::db::{Database, TrackInput};
use lofty::prelude::*;
use lofty::read_from_path;
use lofty::tag::Tag;
use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

const AUDIO_EXTS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "oga", "m4a", "aac", "wma", "opus", "mp4",
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub root: String,
    pub total: usize,
    pub current: usize,
    pub found: usize,
    pub status: String,
    pub message: String,
}

pub fn scan_root(app: &AppHandle, db: &Database, root: &str) {
    let Some(job_id) = db.insert_scan_job(root).ok() else {
        return;
    };
    let started = Instant::now();
    emit_progress(app, root, 0, 0, 0, "scanning", "正在遍历目录…".to_string());

    let files: Vec<PathBuf> = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .map(|entry| entry.into_path())
        .filter(|path| is_audio_file(path))
        .collect();

    let total = files.len();
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let mut found = 0usize;
    let mut last_emit = Instant::now();

    for (index, file) in files.iter().enumerate() {
        if let Some(input) = parse_track(file, &app_dir) {
            if db.upsert_track(&input).is_ok() {
                found += 1;
            }
        }
        if last_emit.elapsed() >= Duration::from_millis(80) || index + 1 == total {
            emit_progress(
                app,
                root,
                total,
                index + 1,
                found,
                "scanning",
                format!("扫描中 {}/{}", index + 1, total),
            );
            last_emit = Instant::now();
        }
    }

    db.finish_scan_job(job_id, "done", total as i64, found as i64).ok();
    emit_progress(
        app,
        root,
        total,
        total,
        found,
        "done",
        format!("完成：{found} 首，耗时 {:.1}s", started.elapsed().as_secs_f64()),
    );
}

pub fn watch_roots(app: AppHandle, db: Database) {
    loop {
        let roots: Vec<String> = db
            .list_roots()
            .unwrap_or_default()
            .into_iter()
            .filter(|root| Path::new(root).is_dir())
            .collect();

        if roots.is_empty() {
            std::thread::sleep(Duration::from_secs(3));
            continue;
        }

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(watcher) => watcher,
            Err(_) => {
                std::thread::sleep(Duration::from_secs(3));
                continue;
            }
        };

        let mut ready = true;
        for root in &roots {
            if watcher
                .watch(Path::new(root), RecursiveMode::Recursive)
                .is_err()
            {
                ready = false;
                break;
            }
        }
        if !ready {
            std::thread::sleep(Duration::from_secs(3));
            continue;
        }

        let mut pending = HashSet::new();
        let mut debounce_started = false;
        loop {
            if debounce_started {
                match rx.recv_timeout(Duration::from_millis(1500)) {
                    Ok(event) => collect_event(&mut pending, event, &roots),
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        for root in pending.drain() {
                            scan_root(&app, &db, &root);
                        }
                        debounce_started = false;
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                }
            } else {
                match rx.recv() {
                    Ok(event) => {
                        collect_event(&mut pending, event, &roots);
                        debounce_started = true;
                    }
                    Err(_) => break,
                }
            }
        }
    }
}

fn collect_event(pending: &mut HashSet<String>, event: notify::Result<notify::Event>, roots: &[String]) {
    let Ok(event) = event else {
        return;
    };
    let relevant = matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    );
    if relevant {
        if let Some(path) = event.paths.first() {
            pending.insert(find_root(path, roots));
        }
    }
}

fn find_root(path: &Path, roots: &[String]) -> String {
    for ancestor in path.ancestors() {
        let value = ancestor.to_string_lossy();
        if roots.iter().any(|root| value.as_ref() == root.as_str()) {
            return value.into_owned();
        }
    }
    roots.first().cloned().unwrap_or_default()
}

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTS.iter().any(|candidate| ext.eq_ignore_ascii_case(candidate)))
        .unwrap_or(false)
}

pub(crate) fn parse_track(path: &Path, app_dir: &Path) -> Option<TrackInput> {
    let size_bytes = std::fs::metadata(path).ok()?.len() as i64;
    let tagged = read_from_path(path).ok()?;
    let props = tagged.properties();
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let mut title = String::new();
    let mut artist = String::new();
    let mut album = String::new();
    let mut genre = String::new();
    if let Some(tag) = tag {
        title = tag.title().unwrap_or(std::borrow::Cow::Borrowed("")).trim().to_string();
        artist = tag.artist().unwrap_or(std::borrow::Cow::Borrowed("")).trim().to_string();
        album = tag.album().unwrap_or(std::borrow::Cow::Borrowed("")).trim().to_string();
        genre = tag.genre().unwrap_or(std::borrow::Cow::Borrowed("")).trim().to_string();
    }
    if title.is_empty() {
        title = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
    }

    let cover_path = tag.and_then(|tag| save_cover(app_dir, path, tag));

    Some(TrackInput {
        path: path.to_string_lossy().into_owned(),
        title,
        artist,
        album,
        genre,
        year: tag.and_then(|tag| tag.year()).map(|year| year as i64),
        duration_ms: props.duration().as_millis() as i64,
        bitrate: props.audio_bitrate().map(|value| value as i64),
        sample_rate: props.sample_rate().map(|value| value as i64),
        channels: props.channels().map(|value| value as i64),
        cover_path,
        size_bytes,
    })
}

fn save_cover(app_dir: &Path, audio_path: &Path, tag: &Tag) -> Option<String> {
    let picture = tag.pictures().first()?;
    let data = picture.data();
    if data.is_empty() {
        return None;
    }

    let mut hasher = Sha256::new();
    hasher.update(audio_path.to_string_lossy().as_bytes());
    let hash = hasher.finalize();
    let hex: String = hash.iter().map(|byte| format!("{byte:02x}")).collect();
    let ext = match picture.mime_type().map(|mime| mime.as_str()) {
        Some("image/jpeg") => "jpg",
        Some("image/png") => "png",
        Some("image/webp") => "webp",
        Some("image/gif") => "gif",
        _ => "img",
    };

    let covers_dir = app_dir.join("covers");
    std::fs::create_dir_all(&covers_dir).ok()?;
    let file_path = covers_dir.join(format!("{hex}.{ext}"));
    if !file_path.exists() {
        std::fs::write(&file_path, data).ok()?;
    }
    Some(file_path.to_string_lossy().into_owned())
}

fn emit_progress(
    app: &AppHandle,
    root: &str,
    total: usize,
    current: usize,
    found: usize,
    status: &str,
    message: String,
) {
    let _ = app.emit(
        "scan_progress",
        ScanProgress {
            root: root.to_string(),
            total,
            current,
            found,
            status: status.to_string(),
            message,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::is_audio_file;
    use std::path::Path;

    #[test]
    fn audio_extensions_match_case_insensitively() {
        assert!(is_audio_file(Path::new("song.MP3")));
        assert!(is_audio_file(Path::new("song.flac")));
        assert!(is_audio_file(Path::new("song.wav")));
        assert!(is_audio_file(Path::new("song.opus")));
        assert!(!is_audio_file(Path::new("song.txt")));
        assert!(!is_audio_file(Path::new("song")));
        assert!(!is_audio_file(Path::new("cover.jpg")));
    }
}
