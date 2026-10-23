use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: String,
    pub duration_ms: i64,
    pub bitrate: Option<i64>,
    pub sample_rate: Option<i64>,
    pub channels: Option<i64>,
    pub cover_path: Option<String>,
    pub size_bytes: i64,
    pub added_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct TrackInput {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: String,
    pub duration_ms: i64,
    pub bitrate: Option<i64>,
    pub sample_rate: Option<i64>,
    pub channels: Option<i64>,
    pub cover_path: Option<String>,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub track_count: i64,
    pub folder_count: i64,
    pub total_duration_ms: i64,
    pub total_size_bytes: i64,
    pub last_scanned_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackClassification {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub current_genre: String,
    pub suggested_genre: Option<String>,
    pub confidence: Option<f64>,
    pub source: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyStats {
    pub total: i64,
    pub classified: i64,
    pub pending: i64,
    pub unclassified: i64,
    pub source_counts: HashMap<String, i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationPage {
    pub items: Vec<TrackClassification>,
    pub stats: ClassifyStats,
}

impl Database {
    pub fn open(dir: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(dir)?;
        let conn = Connection::open(dir.join("neptune.db"))?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;",
        )?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS tracks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              path TEXT NOT NULL UNIQUE,
              title TEXT NOT NULL DEFAULT '',
              artist TEXT NOT NULL DEFAULT '',
              album TEXT NOT NULL DEFAULT '',
              genre TEXT NOT NULL DEFAULT '',
              duration_ms INTEGER NOT NULL DEFAULT 0,
              bitrate INTEGER,
              sample_rate INTEGER,
              channels INTEGER,
              cover_path TEXT,
              size_bytes INTEGER NOT NULL DEFAULT 0,
              added_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
              title, artist, album,
              content='tracks',
              content_rowid='id',
              tokenize='trigram'
            );

            CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
              INSERT INTO tracks_fts(rowid, title, artist, album)
              VALUES (new.id, new.title, new.artist, new.album);
            END;

            CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
              INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album)
              VALUES ('delete', old.id, old.title, old.artist, old.album);
            END;

            CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
              INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album)
              VALUES ('delete', old.id, old.title, old.artist, old.album);
              INSERT INTO tracks_fts(rowid, title, artist, album)
              VALUES (new.id, new.title, new.artist, new.album);
            END;

            CREATE TABLE IF NOT EXISTS scan_jobs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              root TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'running',
              started_at TEXT NOT NULL DEFAULT (datetime('now')),
              finished_at TEXT,
              total INTEGER NOT NULL DEFAULT 0,
              found INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS playlists (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              description TEXT,
              cover_path TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS playlist_tracks (
              playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
              track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
              position INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (playlist_id, track_id)
            );

            CREATE TABLE IF NOT EXISTS track_genres (
              track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
              genre TEXT NOT NULL,
              confidence REAL NOT NULL DEFAULT 1.0,
              source TEXT NOT NULL DEFAULT 'metadata',
              PRIMARY KEY (track_id, genre)
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            ",
        )?;
        Ok(())
    }

    pub fn upsert_track(&self, input: &TrackInput) -> Result<i64, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let id = conn.query_row(
            "
            INSERT INTO tracks (
              path, title, artist, album, genre, duration_ms, bitrate,
              sample_rate, channels, cover_path, size_bytes, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
            ON CONFLICT(path) DO UPDATE SET
              title=excluded.title,
              artist=excluded.artist,
              album=excluded.album,
              genre=excluded.genre,
              duration_ms=excluded.duration_ms,
              bitrate=excluded.bitrate,
              sample_rate=excluded.sample_rate,
              channels=excluded.channels,
              cover_path=excluded.cover_path,
              size_bytes=excluded.size_bytes,
              updated_at=datetime('now')
            RETURNING id;
            ",
            params![
                input.path,
                input.title,
                input.artist,
                input.album,
                input.genre,
                input.duration_ms,
                input.bitrate,
                input.sample_rate,
                input.channels,
                input.cover_path,
                input.size_bytes,
            ],
            |row| row.get(0),
        )?;
        if !input.genre.trim().is_empty() {
            conn.execute(
                "
                INSERT OR IGNORE INTO track_genres (track_id, genre, confidence, source)
                VALUES (?1, ?2, 0.95, 'metadata');
                ",
                params![id, input.genre.trim()],
            )?;
        }
        Ok(id)
    }

    pub fn list_tracks(
        &self,
        query: Option<&str>,
        sort: Option<&str>,
        page: u32,
        limit: u32,
    ) -> Result<Vec<Track>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let order = Self::sort_clause(sort.unwrap_or("title"));
        let offset = page.saturating_mul(limit);
        let q = query.map(str::trim).filter(|s| !s.is_empty());

        let tracks = match q {
            Some(raw) if raw.chars().count() >= 3 => {
                let phrase = format!("\"{}\"", raw.replace('"', "\"\""));
                let mut stmt = conn.prepare(&format!(
                    "
                    SELECT id, path, title, artist, album, genre, duration_ms,
                           bitrate, sample_rate, channels, cover_path,
                           size_bytes, added_at, updated_at
                    FROM tracks
                    WHERE id IN (SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?1)
                    {order}
                    LIMIT ?2 OFFSET ?3;
                    "
                ))?;
                let rows = stmt.query_map(params![phrase, limit, offset], Self::track_from_row)?;
                rows.collect::<Result<Vec<_>, _>>()?
            }
            Some(raw) => {
                let escaped = raw
                    .replace('\\', "\\\\")
                    .replace('%', "\\%")
                    .replace('_', "\\_");
                let pattern = format!("%{escaped}%");
                let mut stmt = conn.prepare(&format!(
                    "
                    SELECT id, path, title, artist, album, genre, duration_ms,
                           bitrate, sample_rate, channels, cover_path,
                           size_bytes, added_at, updated_at
                    FROM tracks
                    WHERE title LIKE ?1 ESCAPE '\\'
                       OR artist LIKE ?1 ESCAPE '\\'
                       OR album LIKE ?1 ESCAPE '\\'
                    {order}
                    LIMIT ?2 OFFSET ?3;
                    "
                ))?;
                let rows = stmt.query_map(params![pattern, limit, offset], Self::track_from_row)?;
                rows.collect::<Result<Vec<_>, _>>()?
            }
            None => {
                let mut stmt = conn.prepare(&format!(
                    "
                    SELECT id, path, title, artist, album, genre, duration_ms,
                           bitrate, sample_rate, channels, cover_path,
                           size_bytes, added_at, updated_at
                    FROM tracks
                    {order}
                    LIMIT ?1 OFFSET ?2;
                    "
                ))?;
                let rows = stmt.query_map(params![limit, offset], Self::track_from_row)?;
                rows.collect::<Result<Vec<_>, _>>()?
            }
        };
        Ok(tracks)
    }

    pub fn get_track(&self, id: i64) -> Result<Option<Track>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "
            SELECT id, path, title, artist, album, genre, duration_ms,
                   bitrate, sample_rate, channels, cover_path,
                   size_bytes, added_at, updated_at
            FROM tracks WHERE id = ?1;
            ",
            params![id],
            Self::track_from_row,
        )
        .optional()
    }

    pub fn library_stats(&self) -> Result<LibraryStats, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let (track_count, total_duration_ms, total_size_bytes) = conn.query_row(
            "
            SELECT COUNT(*), COALESCE(SUM(duration_ms), 0), COALESCE(SUM(size_bytes), 0)
            FROM tracks;
            ",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)),
        )?;
        let (folder_count, last_scanned_at) = conn.query_row(
            "
            SELECT COUNT(DISTINCT root),
                   MAX(finished_at)
            FROM scan_jobs WHERE status = 'done';
            ",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?)),
        )?;
        Ok(LibraryStats {
            track_count,
            folder_count,
            total_duration_ms,
            total_size_bytes,
            last_scanned_at,
        })
    }

    pub fn upsert_suggestion(
        &self,
        track_id: i64,
        genre: &str,
        confidence: f64,
        source: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO track_genres (track_id, genre, confidence, source)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(track_id, genre) DO UPDATE SET
              confidence = excluded.confidence,
              source = excluded.source;
            ",
            params![track_id, genre, confidence, source],
        )?;
        Ok(())
    }

    pub fn apply_genre(
        &self,
        track_id: i64,
        genre: &str,
        source: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tracks SET genre = ?1, updated_at = datetime('now') WHERE id = ?2;",
            params![genre, track_id],
        )?;
        conn.execute(
            "
            INSERT INTO track_genres (track_id, genre, confidence, source)
            VALUES (?1, ?2, 1.0, ?3)
            ON CONFLICT(track_id, genre) DO UPDATE SET
              confidence = 1.0,
              source = excluded.source;
            ",
            params![track_id, genre, source],
        )?;
        Ok(())
    }

    pub fn apply_genres_batch(
        &self,
        ids: &[i64],
        genre: &str,
        source: &str,
    ) -> Result<usize, rusqlite::Error> {
        if ids.is_empty() {
            return Ok(0);
        }
        let conn = self.conn.lock().unwrap();
        conn.execute("BEGIN", [])?;
        let result = (|| {
            for &track_id in ids {
                conn.execute(
                    "UPDATE tracks SET genre = ?1, updated_at = datetime('now') WHERE id = ?2;",
                    params![genre, track_id],
                )?;
                conn.execute(
                    "
                    INSERT INTO track_genres (track_id, genre, confidence, source)
                    VALUES (?1, ?2, 1.0, ?3)
                    ON CONFLICT(track_id, genre) DO UPDATE SET
                      confidence = 1.0,
                      source = excluded.source;
                    ",
                    params![track_id, genre, source],
                )?;
            }
            Ok(ids.len())
        })();
        match result {
            Ok(applied) => {
                conn.execute("COMMIT", [])?;
                Ok(applied)
            }
            Err(err) => {
                conn.execute("ROLLBACK", []).ok();
                Err(err)
            }
        }
    }

    pub fn classification_stats(&self) -> Result<ClassifyStats, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let (total, classified, pending, unclassified) = conn.query_row(
            "
            SELECT
              COUNT(*),
              COALESCE(SUM(
                CASE
                  WHEN t.genre <> '' AND (
                    (SELECT g.genre FROM track_genres g
                     WHERE g.track_id = t.id AND g.source <> 'manual'
                     ORDER BY g.confidence DESC, g.rowid LIMIT 1) IS NULL
                    OR (SELECT g.genre FROM track_genres g
                        WHERE g.track_id = t.id AND g.source <> 'manual'
                        ORDER BY g.confidence DESC, g.rowid LIMIT 1) = t.genre
                  ) THEN 1 ELSE 0 END
              ), 0),
              COALESCE(SUM(
                CASE
                  WHEN (SELECT g.genre FROM track_genres g
                        WHERE g.track_id = t.id AND g.source <> 'manual'
                        ORDER BY g.confidence DESC, g.rowid LIMIT 1) IS NOT NULL
                    AND (SELECT g.genre FROM track_genres g
                         WHERE g.track_id = t.id AND g.source <> 'manual'
                         ORDER BY g.confidence DESC, g.rowid LIMIT 1) <> t.genre
                  THEN 1 ELSE 0 END
              ), 0),
              COALESCE(SUM(
                CASE
                  WHEN t.genre = '' AND (
                    SELECT g.genre FROM track_genres g
                    WHERE g.track_id = t.id AND g.source <> 'manual'
                    ORDER BY g.confidence DESC, g.rowid LIMIT 1
                  ) IS NULL THEN 1 ELSE 0 END
              ), 0)
            FROM tracks t;
            ",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )?;

        let mut source_counts = HashMap::new();
        for source in ["metadata", "local", "network", "manual"] {
            source_counts.insert(source.to_string(), 0);
        }
        let mut stmt = conn.prepare(
            "SELECT source, COUNT(*) FROM track_genres GROUP BY source;",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        for (source, count) in rows {
            source_counts.insert(source, count);
        }

        Ok(ClassifyStats {
            total,
            classified,
            pending,
            unclassified,
            source_counts,
        })
    }

    pub fn list_classifications(
        &self,
        status: Option<&str>,
        page: u32,
        limit: u32,
    ) -> Result<ClassificationPage, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let offset = page.saturating_mul(limit);
        let filter = status.map(str::trim).filter(|s| !s.is_empty());
        let mut sql = String::from(
            "
            SELECT
              t.id, t.title, t.artist, t.album, t.genre,
              (SELECT g.genre FROM track_genres g
               WHERE g.track_id = t.id AND g.source <> 'manual'
               ORDER BY g.confidence DESC, g.rowid LIMIT 1) AS suggested_genre,
              (SELECT g.confidence FROM track_genres g
               WHERE g.track_id = t.id AND g.source <> 'manual'
               ORDER BY g.confidence DESC, g.rowid LIMIT 1) AS confidence,
              (SELECT g.source FROM track_genres g
               WHERE g.track_id = t.id AND g.source <> 'manual'
               ORDER BY g.confidence DESC, g.rowid LIMIT 1) AS source
            FROM tracks t
            ",
        );
        if filter.is_some() {
            sql.push_str(
                "
                WHERE (
                  CASE
                    WHEN t.genre <> '' AND (
                      (SELECT g.genre FROM track_genres g
                       WHERE g.track_id = t.id AND g.source <> 'manual'
                       ORDER BY g.confidence DESC, g.rowid LIMIT 1) IS NULL
                      OR (SELECT g.genre FROM track_genres g
                          WHERE g.track_id = t.id AND g.source <> 'manual'
                          ORDER BY g.confidence DESC, g.rowid LIMIT 1) = t.genre
                    ) THEN 'classified'
                    WHEN (SELECT g.genre FROM track_genres g
                          WHERE g.track_id = t.id AND g.source <> 'manual'
                          ORDER BY g.confidence DESC, g.rowid LIMIT 1) IS NOT NULL
                      THEN 'pending'
                    WHEN t.genre = '' THEN 'unclassified'
                    ELSE 'classified'
                  END
                ) = ?1
                ",
            );
        }
        sql.push_str(
            "
            ORDER BY t.title COLLATE NOCASE, t.id ASC
            LIMIT ?2 OFFSET ?3;
            ",
        );

        let mut items = Vec::new();
        let mut stmt = conn.prepare(&sql)?;
        let rows = if filter.is_some() {
            stmt.query_map(params![filter, limit, offset], Self::classification_from_row)?
        } else {
            stmt.query_map(params![limit, offset], Self::classification_from_row)?
        };
        for row in rows {
            items.push(row?);
        }
        drop(stmt);
        drop(conn);

        let stats = self.classification_stats()?;
        Ok(ClassificationPage { items, stats })
    }

    pub fn list_all_track_ids(&self) -> Result<Vec<i64>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id FROM tracks ORDER BY id;")?;
        let ids = stmt
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(ids)
    }

    pub fn insert_scan_job(&self, root: &str) -> Result<i64, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "INSERT INTO scan_jobs (root, status) VALUES (?1, 'running') RETURNING id;",
            params![root],
            |row| row.get(0),
        )
    }

    pub fn finish_scan_job(
        &self,
        id: i64,
        status: &str,
        total: i64,
        found: i64,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            UPDATE scan_jobs
            SET status = ?1, finished_at = datetime('now'), total = ?2, found = ?3
            WHERE id = ?4;
            ",
            params![status, total, found, id],
        )?;
        Ok(())
    }

    pub fn list_roots(&self) -> Result<Vec<String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT DISTINCT root FROM scan_jobs;")?;
        let roots = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(roots)
    }

    #[allow(dead_code)]
    pub fn prune_scan_jobs(&self, max_age_days: i64) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM scan_jobs WHERE datetime(finished_at) < datetime('now', ?1);",
            params![format!("-{max_age_days} days")],
        )?;
        Ok(())
    }

    fn track_from_row(row: &Row<'_>) -> rusqlite::Result<Track> {
        Ok(Track {
            id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            genre: row.get(5)?,
            duration_ms: row.get(6)?,
            bitrate: row.get(7)?,
            sample_rate: row.get(8)?,
            channels: row.get(9)?,
            cover_path: row.get(10)?,
            size_bytes: row.get(11)?,
            added_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }

    fn classification_from_row(row: &Row<'_>) -> rusqlite::Result<TrackClassification> {
        let id: i64 = row.get(0)?;
        let title: String = row.get(1)?;
        let artist: String = row.get(2)?;
        let album: String = row.get(3)?;
        let current_genre: String = row.get(4)?;
        let suggested_genre: Option<String> = row.get(5)?;
        let confidence: Option<f64> = row.get(6)?;
        let source: Option<String> = row.get(7)?;
        let status = match (current_genre.as_str(), suggested_genre.as_deref()) {
            ("", None) => "unclassified",
            ("", Some(_)) => "pending",
            (_, Some(s)) if s == current_genre => "classified",
            (_, Some(_)) => "pending",
            (_, None) => "classified",
        };
        Ok(TrackClassification {
            id,
            title,
            artist,
            album,
            current_genre,
            suggested_genre,
            confidence,
            source,
            status: status.to_string(),
        })
    }

    fn sort_clause(sort: &str) -> String {
        let (col, dir) = sort.rsplit_once(':').unwrap_or((sort, "asc"));
        let col = match col {
            "title" => "title COLLATE NOCASE",
            "artist" => "artist COLLATE NOCASE",
            "album" => "album COLLATE NOCASE",
            "duration" => "duration_ms",
            "added" => "added_at",
            "updated" => "updated_at",
            "path" => "path",
            _ => "title COLLATE NOCASE",
        };
        let dir = if dir == "desc" { "DESC" } else { "ASC" };
        format!("ORDER BY {col} {dir}, id ASC")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_db() -> Database {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("neptune-test-{}-{id}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        Database::open(&dir).expect("open test db")
    }

    fn input(
        path: &str,
        title: &str,
        artist: &str,
        album: &str,
        genre: &str,
        duration_ms: i64,
    ) -> TrackInput {
        TrackInput {
            path: path.to_string(),
            title: title.to_string(),
            artist: artist.to_string(),
            album: album.to_string(),
            genre: genre.to_string(),
            duration_ms,
            bitrate: Some(320000),
            sample_rate: Some(44100),
            channels: Some(2),
            cover_path: None,
            size_bytes: 1024 * 1024,
        }
    }

    #[test]
    fn upsert_inserts_then_updates_same_row() {
        let db = temp_db();
        let first = db
            .upsert_track(&input(
                "D:\\music\\a.mp3",
                "夜航",
                "Echo Parade",
                "City Lights",
                "摇滚",
                221000,
            ))
            .unwrap();
        let second = db
            .upsert_track(&input(
                "D:\\music\\a.mp3",
                "夜航重制",
                "Echo Parade",
                "City Lights",
                "摇滚",
                225000,
            ))
            .unwrap();
        assert_eq!(first, second);

        let rows = db.list_tracks(None, Some("title:asc"), 0, 50).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].title, "夜航重制");
        assert_eq!(rows[0].duration_ms, 225000);
    }

    #[test]
    fn list_filters_sorts_and_paginates() {
        let db = temp_db();
        db.upsert_track(&input(
            "D:\\music\\1.mp3",
            "潮汐",
            "深海电台",
            "蓝色时刻",
            "电子",
            254000,
        ))
        .unwrap();
        db.upsert_track(&input(
            "D:\\music\\2.mp3",
            "慢板",
            "林晚",
            "一席之地",
            "古典",
            402000,
        ))
        .unwrap();
        db.upsert_track(&input(
            "D:\\music\\3.mp3",
            "街角咖啡",
            "Miles Quartet",
            "Sunday Sessions",
            "爵士",
            318000,
        ))
        .unwrap();

        let by_duration = db.list_tracks(None, Some("duration:desc"), 0, 50).unwrap();
        assert_eq!(by_duration[0].title, "慢板");

        let by_artist = db.list_tracks(Some("Miles"), Some("title:asc"), 0, 50).unwrap();
        assert_eq!(by_artist.len(), 1);
        assert_eq!(by_artist[0].title, "街角咖啡");

        let by_album_fts = db.list_tracks(Some("Sunday"), Some("title:asc"), 0, 50).unwrap();
        assert_eq!(by_album_fts.len(), 1);
        assert_eq!(by_album_fts[0].title, "街角咖啡");

        let page_one = db.list_tracks(None, Some("title:asc"), 0, 2).unwrap();
        let page_two = db.list_tracks(None, Some("title:asc"), 1, 2).unwrap();
        assert_eq!(page_one.len(), 2);
        assert_eq!(page_two.len(), 1);
        assert!(page_one.iter().all(|row| row.id != page_two[0].id));
    }

    #[test]
    fn stats_aggregate_tracks_and_scanned_roots() {
        let db = temp_db();
        db.upsert_track(&input(
            "D:\\music\\A\\1.mp3",
            "潮汐",
            "深海电台",
            "蓝色时刻",
            "电子",
            254000,
        ))
        .unwrap();
        db.upsert_track(&input(
            "D:\\music\\B\\2.mp3",
            "慢板",
            "林晚",
            "一席之地",
            "古典",
            402000,
        ))
        .unwrap();

        for root in ["D:\\music\\A", "D:\\music\\B"] {
            let job = db.insert_scan_job(root).unwrap();
            db.finish_scan_job(job, "done", 1, 1).unwrap();
        }

        let stats = db.library_stats().unwrap();
        assert_eq!(stats.track_count, 2);
        assert_eq!(stats.folder_count, 2);
        assert_eq!(stats.total_duration_ms, 656000);
        assert_eq!(stats.total_size_bytes, 2 * 1024 * 1024);
        assert!(stats.last_scanned_at.is_some());

        let roots = db.list_roots().unwrap();
        assert_eq!(roots.len(), 2);
    }

    #[test]
    fn get_track_and_prune_scan_jobs() {
        let db = temp_db();
        let id = db
            .upsert_track(&input(
                "D:\\music\\one.flac",
                "极光之后",
                "Aurora Waves",
                "Northern Bloom",
                "氛围",
                372000,
            ))
            .unwrap();
        let track = db.get_track(id).unwrap().expect("track should exist");
        assert_eq!(track.genre, "氛围");
        assert!(db.get_track(id + 999).unwrap().is_none());

        let job = db.insert_scan_job("D:\\music\\old").unwrap();
        db.finish_scan_job(job, "done", 0, 0).unwrap();
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "UPDATE scan_jobs SET finished_at = datetime('now', '-40 days') WHERE id = ?1",
                params![job],
            )
            .unwrap();
        }
        db.prune_scan_jobs(30).unwrap();
        assert!(db.list_roots().unwrap().is_empty());
    }
}
