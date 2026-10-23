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
