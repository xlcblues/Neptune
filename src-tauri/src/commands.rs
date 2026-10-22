use crate::db::Database;
use crate::indexer;
use tauri::{AppHandle, State};

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
