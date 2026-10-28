use crate::classifier;
use crate::db::{ClassificationPage, ClassifyStats, Database};
use crate::indexer;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn add_folders(
    app: AppHandle,
    db: State<'_, Database>,
    paths: Vec<String>,
) -> Result<(), String> {
    for path in &paths {
        if !std::path::Path::new(path).is_dir() {
            return Err(format!("目录不存在：{path}"));
        }
        app.asset_protocol_scope()
            .allow_directory(path, true)
            .map_err(|err| format!("无法授权音频目录：{path}，{err}"))?;
        db.insert_scan_job(path).map_err(|err| err.to_string())?;
    }

    let runner_db = db.inner().clone();
    std::thread::spawn(move || {
        for path in paths {
            indexer::scan_root(&app, &runner_db, &path);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn list_tracks(
    db: State<'_, Database>,
    query: Option<String>,
    sort: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<crate::db::Track>, String> {
    db.list_tracks(
        query.as_deref(),
        sort.as_deref(),
        page.unwrap_or(0),
        limit.unwrap_or(200),
    )
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_track(
    db: State<'_, Database>,
    id: i64,
) -> Result<Option<crate::db::Track>, String> {
    db.get_track(id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_library_stats(db: State<'_, Database>) -> Result<crate::db::LibraryStats, String> {
    db.library_stats().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn ensure_audio_access(app: AppHandle, path: String) -> Result<(), String> {
    let file = std::path::Path::new(&path);
    if !file.is_file() {
        return Err(format!("文件不存在：{path}"));
    }
    let dir = file
        .parent()
        .ok_or_else(|| "路径无效".to_string())?;
    app.asset_protocol_scope()
        .allow_directory(dir, true)
        .map_err(|err| format!("无法授权音频目录：{}，{err}", dir.display()))
}

#[tauri::command]
pub fn classify_track(
    db: State<'_, Database>,
    id: i64,
    use_network: bool,
) -> Result<Vec<crate::classifier::ClassifyResult>, String> {
    let result = classifier::classify_track(&db, id, use_network)?;
    Ok(vec![result])
}

#[tauri::command]
pub fn classify_all(
    app: AppHandle,
    db: State<'_, Database>,
    use_network: bool,
) -> Result<(), String> {
    classifier::classify_all(app, db.inner().clone(), use_network);
    Ok(())
}

#[tauri::command]
pub fn classify_batch(
    app: AppHandle,
    db: State<'_, Database>,
    ids: Vec<i64>,
    use_network: bool,
) -> Result<(), String> {
    classifier::classify_batch(app, db.inner().clone(), ids, use_network);
    Ok(())
}

#[tauri::command]
pub fn list_classifications(
    db: State<'_, Database>,
    status: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
) -> Result<ClassificationPage, String> {
    db.list_classifications(
        status.as_deref(),
        page.unwrap_or(0),
        limit.unwrap_or(200),
    )
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_classify_stats(db: State<'_, Database>) -> Result<ClassifyStats, String> {
    db.classification_stats().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn apply_genre(
    db: State<'_, Database>,
    track_id: i64,
    genre: String,
    source: Option<String>,
) -> Result<(), String> {
    db.apply_genre(track_id, &genre, source.as_deref().unwrap_or("manual"))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn apply_genres_batch(
    db: State<'_, Database>,
    ids: Vec<i64>,
    genre: String,
    source: Option<String>,
) -> Result<usize, String> {
    db.apply_genres_batch(&ids, &genre, source.as_deref().unwrap_or("manual"))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn create_playlist(
    db: State<'_, Database>,
    name: String,
    description: Option<String>,
) -> Result<crate::db::Playlist, String> {
    db.create_playlist(&name, description.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_playlist(
    db: State<'_, Database>,
    id: i64,
    name: Option<String>,
    description: Option<String>,
) -> Result<crate::db::Playlist, String> {
    db.update_playlist(id, name.as_deref(), description.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_playlist_cover(
    db: State<'_, Database>,
    id: i64,
    cover_path: Option<String>,
) -> Result<crate::db::Playlist, String> {
    db.update_playlist_cover(id, cover_path.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_playlist(db: State<'_, Database>, id: i64) -> Result<(), String> {
    db.delete_playlist(id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_playlists(db: State<'_, Database>) -> Result<Vec<crate::db::Playlist>, String> {
    db.list_playlists().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_playlist_detail(
    db: State<'_, Database>,
    id: i64,
) -> Result<Option<crate::db::PlaylistDetail>, String> {
    db.get_playlist_detail(id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn add_tracks_to_playlist(
    db: State<'_, Database>,
    id: i64,
    track_ids: Vec<i64>,
) -> Result<usize, String> {
    db.add_tracks_to_playlist(id, &track_ids)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn remove_tracks_from_playlist(
    db: State<'_, Database>,
    id: i64,
    track_ids: Vec<i64>,
) -> Result<usize, String> {
    db.remove_tracks_from_playlist(id, &track_ids)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn reorder_playlist(
    db: State<'_, Database>,
    id: i64,
    ordered_ids: Vec<i64>,
) -> Result<(), String> {
    db.reorder_playlist(id, &ordered_ids)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn create_smart_playlist(
    db: State<'_, Database>,
    name: String,
    description: Option<String>,
    genre: Option<String>,
    year_start: Option<i64>,
    year_end: Option<i64>,
    min_duration_ms: Option<i64>,
    max_duration_ms: Option<i64>,
) -> Result<crate::db::PlaylistDetail, String> {
    db.create_smart_playlist(
        &name,
        description.as_deref(),
        genre.as_deref(),
        year_start,
        year_end,
        min_duration_ms,
        max_duration_ms,
    )
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn preview_smart_playlist(
    db: State<'_, Database>,
    genre: Option<String>,
    year_start: Option<i64>,
    year_end: Option<i64>,
    min_duration_ms: Option<i64>,
    max_duration_ms: Option<i64>,
) -> Result<Vec<crate::db::Track>, String> {
    db.smart_playlist_tracks(
        genre.as_deref(),
        year_start,
        year_end,
        min_duration_ms,
        max_duration_ms,
    )
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_track_metadata(
    db: State<'_, Database>,
    id: i64,
    title: String,
    artist: String,
    album: String,
    genre: String,
) -> Result<(), String> {
    db.update_track_metadata(id, &title, &artist, &album, &genre)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn set_track_cover(
    db: State<'_, Database>,
    id: i64,
    cover_path: Option<String>,
) -> Result<(), String> {
    db.set_track_cover(id, cover_path.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn export_m3u(file_path: String, content: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if extension != "m3u" && extension != "m3u8" {
        return Err("仅支持导出 .m3u 或 .m3u8 播放列表".to_string());
    }
    std::fs::write(path, content).map_err(|err| err.to_string())
}
