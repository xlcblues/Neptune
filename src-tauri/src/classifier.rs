use crate::db::Database;
use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const USER_AGENT: &str = "Neptune/0.1.0 (local music player)";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyResult {
    pub track_id: i64,
    pub genre: Option<String>,
    pub confidence: Option<f64>,
    pub source: Option<String>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyProgress {
    pub total: u32,
    pub current: u32,
    pub found: u32,
    pub status: String,
    pub message: String,
}

/// Canonical genre label followed by matching terms (Chinese name + English aliases).
const GENRE_ALIASES: &[(&str, &[&str])] = &[
    ("摇滚", &["摇滚", "rock", "hard rock", "alt rock", "alternative rock", "progressive rock"]),
    ("流行", &["流行", "pop", "mandopop", "cantopop", "dance pop", "synth pop"]),
    ("电子", &["电子", "电音", "electronic", "edm", "electro", "techno", "house", "trance", "dance", "synthwave", "drum and bass", "dubstep", "breakbeat", "idm"]),
    ("爵士", &["爵士", "jazz", "smooth jazz", "bebop", "fusion", "acid jazz", "latin jazz"]),
    ("古典", &["古典", "classical", "orchestral", "symphony", "symphonic", "piano", "chamber", "opera", "baroque", "romantic"]),
    ("氛围", &["氛围", "ambient", "atmospheric", "drone", "chillout", "cinematic", "new age"]),
    ("民谣", &["民谣", "folk", "acoustic", "singer-songwriter", "americana"]),
    ("嘻哈", &["嘻哈", "说唱", "hip hop", "hip-hop", "rap", "trap", "r&b", "rnb"]),
    ("金属", &["金属", "metal", "heavy metal", "metalcore", "thrash", "death metal", "black metal", "power metal"]),
    ("朋克", &["朋克", "punk", "punk rock", "pop punk", "post-punk", "hardcore"]),
    ("乡村", &["乡村", "country", "country rock", "bluegrass"]),
    ("蓝调", &["蓝调", "blues", "rhythm and blues", "soul", "funk"]),
    ("雷鬼", &["雷鬼", "reggae", "dancehall", "ska"]),
    ("拉丁", &["拉丁", "latin", "salsa", "bossa nova", "bossanova", "samba", "flamenco"]),
    ("原声", &["原声", "配乐", "soundtrack", "film score", "score", "ost", "game music", "video game"]),
    ("低保真", &["低保真", "lo-fi", "lofi", "chillhop", "study music"]),
    ("独立", &["独立", "indie", "indie pop", "indie rock", "dream pop", "shoegaze"]),
    ("实验", &["实验", "experimental", "avant-garde", "noise", "glitch"]),
    ("世界音乐", &["世界", "world", "world music", "afrobeat", "celtic"]),
    ("器乐", &["器乐", "instrumental", "instrumental rock", "guitar"]),
    ("K-Pop", &["k-pop", "kpop"]),
    ("J-Pop", &["j-pop", "jpop"]),
    ("动漫", &["动漫", "anime", "anison"]),
    ("舞曲", &["舞曲", "disco", "club", "party", "uplifting"]),
    ("轻音乐", &["轻音乐", "轻音", "easy listening", "muzak", "background music", "soft music"]),
    ("新世纪", &["新世纪", "new age", "meditation", "spa"]),
    ("宗教", &["宗教", "gospel", "christian", "hymn", "praise", "worship"]),
    ("儿歌", &["儿歌", "童谣", "children", "kids", "nursery"]),
];

pub fn canonical_genre(raw: &str) -> Option<String> {
    let normalized = raw.trim().to_lowercase();
    if normalized.is_empty() {
        return None;
    }
    for (canonical, terms) in GENRE_ALIASES {
        for &term in *terms {
            let term = term.to_lowercase();
            if normalized == term || (term.len() > 2 && normalized.contains(&term)) {
                return Some(canonical.to_string());
            }
        }
    }
    None
}

/// Lightweight local inference from title / artist / album keywords.
const TITLE_HINTS: &[(&str, &[&str])] = &[
    ("摇滚", &["吉他", "摇滚", "失真", "riff", "电声"]),
    ("电子", &["电子", "电音", "synth", "techno", "club", "dance", "remix", "disco", "house"]),
    ("民谣", &["民谣", "木吉他", "acoustic", "folk", "弹唱"]),
    ("古典", &["古典", "钢琴", "piano", "symphony", "交响", "奏鸣曲", "协奏曲"]),
    ("爵士", &["爵士", "jazz", "萨克斯"]),
    ("氛围", &["氛围", "ambient", "极光", "白噪音", "入眠", "冥想", "放松"]),
    ("嘻哈", &["说唱", "嘻哈", "rap", "hip", "trap", "beat"]),
    ("蓝调", &["蓝调", "blues", "灵魂乐", "soul"]),
    ("金属", &["金属", "metal", "重型"]),
    ("原声", &["原声", "ost", "配乐", "soundtrack", "主题曲", "游戏"]),
    ("轻音乐", &["轻音乐", "轻音", "纯音"]),
    ("儿歌", &["儿歌", "童谣", "摇篮曲"]),
    ("K-Pop", &["k-pop", "kpop", "韩流"]),
    ("J-Pop", &["j-pop", "jpop", "日系"]),
    ("动漫", &["动漫", "anime"]),
    ("乡村", &["乡村", "country"]),
    ("雷鬼", &["雷鬼", "reggae"]),
    ("拉丁", &["拉丁", "latin", "桑巴", "salsa"]),
    ("独立", &["独立", "indie", "小众"]),
];

fn infer_from_metadata(title: &str, artist: &str, album: &str) -> Option<(String, f64)> {
    let title_lower = title.to_lowercase();
    let context_lower = format!("{artist} {album}").to_lowercase();
    for (canonical, hints) in TITLE_HINTS {
        for &hint in *hints {
            let hint_lower = hint.to_lowercase();
            if title_lower.contains(&hint_lower) {
                return Some((canonical.to_string(), 0.82));
            }
        }
    }
    for (canonical, hints) in TITLE_HINTS {
        for &hint in *hints {
            let hint_lower = hint.to_lowercase();
            if context_lower.contains(&hint_lower) {
                return Some((canonical.to_string(), 0.72));
            }
        }
    }
    None
}

pub fn classify_track(
    db: &Database,
    track_id: i64,
    use_network: bool,
) -> Result<ClassifyResult, String> {
    let track = db
        .get_track(track_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| format!("曲目不存在：{track_id}"))?;

    // 1. Prefer metadata embedded in the file.
    if !track.genre.trim().is_empty() {
        let canonical =
            canonical_genre(&track.genre).unwrap_or_else(|| track.genre.trim().to_string());
        db.upsert_suggestion(track_id, &canonical, 0.95, "metadata")
            .map_err(|err| err.to_string())?;
        return Ok(ClassifyResult {
            track_id,
            genre: Some(canonical),
            confidence: Some(0.95),
            source: Some("metadata".to_string()),
            note: "来自文件内流派标签".to_string(),
        });
    }

    // 2. Local heuristic inference from title / artist / album.
    if let Some((genre, confidence)) = infer_from_metadata(&track.title, &track.artist, &track.album)
    {
        db.upsert_suggestion(track_id, &genre, confidence, "local")
            .map_err(|err| err.to_string())?;
        return Ok(ClassifyResult {
            track_id,
            genre: Some(genre),
            confidence: Some(confidence),
            source: Some("local".to_string()),
            note: "根据标题与艺人本地推断".to_string(),
        });
    }

    // 3. Network metadata from MusicBrainz.
    if use_network {
        match query_musicbrainz(&track) {
            Ok(Some((genre, confidence))) => {
                db.upsert_suggestion(track_id, &genre, confidence, "network")
                    .map_err(|err| err.to_string())?;
                return Ok(ClassifyResult {
                    track_id,
                    genre: Some(genre),
                    confidence: Some(confidence),
                    source: Some("network".to_string()),
                    note: "来自 MusicBrainz 社区标签".to_string(),
                });
            }
            Ok(None) => {
                return Ok(ClassifyResult {
                    track_id,
                    genre: None,
                    confidence: None,
                    source: None,
                    note: "MusicBrainz 未找到匹配".to_string(),
                });
            }
            Err(err) => {
                return Ok(ClassifyResult {
                    track_id,
                    genre: None,
                    confidence: None,
                    source: None,
                    note: format!("联网查询失败：{err}"),
                });
            }
        }
    }

    Ok(ClassifyResult {
        track_id,
        genre: None,
        confidence: None,
        source: None,
        note: "未找到可用流派信息".to_string(),
    })
}

pub fn classify_all(app: AppHandle, db: Database, use_network: bool) {
    std::thread::spawn(move || {
        let ids = match db.list_all_track_ids() {
            Ok(ids) => ids,
            Err(err) => {
                emit_progress(&app, 0, 0, 0, "error", format!("读取曲库失败：{err}"));
                return;
            }
        };
        run_batch(&app, &db, &ids, use_network);
    });
}

pub fn classify_batch(app: AppHandle, db: Database, ids: Vec<i64>, use_network: bool) {
    std::thread::spawn(move || {
        run_batch(&app, &db, &ids, use_network);
    });
}

fn run_batch(app: &AppHandle, db: &Database, ids: &[i64], use_network: bool) {
    let total = ids.len() as u32;
    if total == 0 {
        emit_progress(
            app,
            0,
            0,
            0,
            "done",
            "曲库为空，没有需要分类的曲目".to_string(),
        );
        return;
    }
    let mut current = 0u32;
    let mut found = 0u32;
    emit_progress(app, total, 0, 0, "running", "开始分类".to_string());
    for &id in ids {
        current += 1;
        match classify_track(db, id, use_network) {
            Ok(result) => {
                if result.genre.is_some() {
                    found += 1;
                }
            }
            Err(_) => {}
        }
        if current % 5 == 0 || current == total {
            emit_progress(
                app,
                total,
                current,
                found,
                "running",
                format!("已完成 {current}/{total} 首"),
            );
        }
        if use_network && current < total {
            std::thread::sleep(Duration::from_millis(1100));
        }
    }
    emit_progress(
        app,
        total,
        total,
        found,
        "done",
        format!("分类完成，共 {found} 首获得流派建议"),
    );
}

fn emit_progress(
    app: &AppHandle,
    total: u32,
    current: u32,
    found: u32,
    status: &str,
    message: String,
) {
    let payload = ClassifyProgress {
        total,
        current,
        found,
        status: status.to_string(),
        message,
    };
    let _ = app.emit("classify_progress", payload);
}

fn query_musicbrainz(track: &crate::db::Track) -> Result<Option<(String, f64)>, String> {
    let title = lucene_field(&track.title);
    let artist = lucene_field(&track.artist);
    let album = lucene_field(&track.album);
    let mut query = format!("recording:\"{title}\" AND artist:\"{artist}\"");
    if !album.is_empty() {
        query.push_str(&format!(" AND release:\"{album}\""));
    }
    let url = format!(
        "https://musicbrainz.org/ws/2/recording?query={}&fmt=json&limit=3",
        url_encode(&query)
    );

    let response = ureq::get(&url)
        .set("User-Agent", USER_AGENT)
        .set("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .call()
        .map_err(|err| err.to_string())?;
    let json: serde_json::Value = response.into_json().map_err(|err| err.to_string())?;

    let mut scores: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    if let Some(recordings) = json.get("recordings").and_then(|v| v.as_array()) {
        for recording in recordings {
            collect_tags(recording.get("tags"), &mut scores);
            if let Some(releases) = recording.get("releases").and_then(|v| v.as_array()) {
                for release in releases {
                    if let Some(group) = release.get("release-group") {
                        collect_tags(group.get("tags"), &mut scores);
                    }
                }
            }
        }
    }

    let mut best: Option<(String, u32)> = None;
    for (raw, count) in &scores {
        if let Some(canonical) = canonical_genre(raw) {
            if best.as_ref().map_or(true, |(_, current)| *count > *current) {
                best = Some((canonical, *count));
            }
        }
    }

    if let Some((genre, count)) = best {
        let confidence = (0.78 + 0.05 * f64::from(count.min(4))).min(0.98);
        return Ok(Some((genre, confidence)));
    }
    Ok(None)
}

fn collect_tags(value: Option<&serde_json::Value>, scores: &mut std::collections::HashMap<String, u32>) {
    let Some(tags) = value.and_then(|v| v.as_array()) else {
        return;
    };
    for tag in tags {
        let name = tag
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();
        let count = tag.get("count").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
        *scores.entry(name).or_insert(0) += count;
    }
}

fn lucene_field(value: &str) -> String {
    value
        .chars()
        .filter(|c| *c != '"' && *c != '\\')
        .collect()
}

fn url_encode(input: &str) -> String {
    let mut out = String::new();
    for &byte in input.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::TrackInput;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_db() -> Database {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "neptune-classifier-test-{}-{id}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        Database::open(&dir).expect("open test db")
    }

    fn input(path: &str, title: &str, artist: &str, album: &str, genre: &str) -> TrackInput {
        TrackInput {
            path: path.to_string(),
            title: title.to_string(),
            artist: artist.to_string(),
            album: album.to_string(),
            genre: genre.to_string(),
            duration_ms: 200000,
            bitrate: Some(320000),
            sample_rate: Some(44100),
            channels: Some(2),
            cover_path: None,
            size_bytes: 1024 * 1024,
            year: None,
        }
    }

    #[test]
    fn canonical_maps_english_and_chinese() {
        assert_eq!(canonical_genre("Rock").as_deref(), Some("摇滚"));
        assert_eq!(canonical_genre("pop").as_deref(), Some("流行"));
        assert_eq!(canonical_genre("Jazz").as_deref(), Some("爵士"));
        assert_eq!(canonical_genre("电子").as_deref(), Some("电子"));
        assert_eq!(canonical_genre("Indie").as_deref(), Some("独立"));
        assert!(canonical_genre("").is_none());
    }

    #[test]
    fn heuristic_hits_title_with_higher_confidence() {
        let result = infer_from_metadata("钢琴独奏练习", "某人", "练习集");
        assert_eq!(result.as_ref().map(|(g, _)| g.as_str()), Some("古典"));
        assert_eq!(result.map(|(_, c)| c), Some(0.82));
    }

    #[test]
    fn metadata_takes_priority_over_heuristic() {
        let db = temp_db();
        let id = db
            .upsert_track(&input(
                "D:\\music\\one.mp3",
                "吉他手",
                "A",
                "B",
                "Jazz",
            ))
            .unwrap();
        let result = classify_track(&db, id, false).unwrap();
        assert_eq!(result.source.as_deref(), Some("metadata"));
        assert_eq!(result.genre.as_deref(), Some("爵士"));
        assert_eq!(result.confidence, Some(0.95));
    }

    #[test]
    fn heuristic_writes_suggestion_when_no_metadata() {
        let db = temp_db();
        let id = db
            .upsert_track(&input(
                "D:\\music\\two.mp3",
                "钢琴之夜",
                "A",
                "B",
                "",
            ))
            .unwrap();
        let result = classify_track(&db, id, false).unwrap();
        assert_eq!(result.source.as_deref(), Some("local"));
        assert_eq!(result.genre.as_deref(), Some("古典"));
    }

    #[test]
    fn url_encode_handles_cn_and_ascii() {
        assert_eq!(url_encode("a b"), "a%20b");
        assert!(url_encode("钢琴").starts_with('%'));
    }
}
