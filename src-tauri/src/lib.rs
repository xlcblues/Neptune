mod commands;
mod db;
mod indexer;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let database = Database::open(&data_dir)?;

            // Runtime asset scope is not persisted across launches; re-allow
            // every scanned root so previously indexed tracks stay playable.
            for root in database.list_roots()? {
                let _ = app.asset_protocol_scope().allow_directory(&root, true);
            }

            let watcher_app = app.handle().clone();
            let watcher_db = database.clone();
            std::thread::spawn(move || {
                indexer::watch_roots(watcher_app, watcher_db);
            });

            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_folders,
            commands::list_tracks,
            commands::get_track,
            commands::get_library_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
