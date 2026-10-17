use rusqlite::{params, params_from_iter, types::{Value, ValueRef}, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as Json};
use std::{collections::BTreeMap, path::Path, sync::Mutex};

pub struct DatabaseState(pub Mutex<Result<Connection, String>>);
const TABLES: &[(&str, &[&str])] = &[
    ("workspaces", &["id", "name", "description", "created_at", "archived"]),
    ("work_items", &["id", "workspace_id", "title", "description", "category", "location", "color", "created_at", "updated_at", "archived"]),
    ("schedule_rules", &["id", "series_id", "work_item_id", "weekdays", "start_time", "end_time", "start_date", "end_date", "anchor_date", "recurrence_type", "interval_weeks", "active"]),
    ("schedule_exceptions", &["id", "rule_id", "original_date", "kind", "target_date", "start_time", "end_time", "status", "note", "deleted"]),
    ("settings", &["id", "value"]),
];
const BANK_TABLES: &[(&str, &[&str])] = &[
    ("curriculum_nodes", &["id", "parent_id", "kind", "code", "name", "description", "sort_order", "archived", "created_at", "updated_at"]),
    ("learning_outcomes", &["id", "node_id", "code", "content", "source", "active", "created_at", "updated_at"]),
    ("question_tags", &["id", "name", "color", "created_at"]),
    ("import_jobs", &["id", "source_name", "status", "total_count", "imported_count", "error_json", "created_at", "updated_at"]),
    ("question_assets", &["id", "question_id", "name", "relative_path", "mime_type", "checksum", "missing", "created_at"]),
    ("questions", &["id", "display_id", "classification_code", "sequence_number", "raw_source", "normalized_source", "content_hash", "question_type", "answer", "solution", "level", "grade_node_id", "domain_node_id", "chapter_node_id", "lesson_node_id", "form_node_id", "primary_outcome_id", "secondary_outcome_ids", "tags", "source", "status", "confidence", "reasoning", "warnings", "has_image", "usage_count", "id_locked", "created_at", "updated_at", "deleted_at"]),
    ("question_revisions", &["id", "question_id", "snapshot", "reason", "created_at"]),
    ("classification_runs", &["id", "question_id", "provider", "model", "result_json", "accepted", "created_at"]),
    ("exams", &["id", "title", "grade_node_id", "duration_minutes", "exam_date", "status", "seed", "created_at", "updated_at"]),
    ("exam_items", &["id", "exam_id", "section_id", "question_id", "question_snapshot", "sort_order", "points", "locked"]),
];
const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../../src/database/migrations/001_initial.sql")),
    (2, include_str!("../../src/database/migrations/002_question_bank.sql")),
    (3, include_str!("../../src/database/migrations/003_question_search.sql")),
];

pub fn open(path: &Path) -> Result<Connection, String> {
    let mut db = Connection::open(path).map_err(|e| e.to_string())?;
    db.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;").map_err(|e| e.to_string())?;
    let version: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version > MIGRATIONS.last().map(|m|m.0).unwrap_or(0) { return Err("Database is newer than this application; update Teacher Workspace.".into()); }
    // Before upgrading a shipped schema, preserve a consistent WAL-inclusive snapshot.
    if version > 0 && version < MIGRATIONS.last().map(|m|m.0).unwrap_or(0) {
        let dir = path.parent().ok_or("Database parent missing")?.join("backups");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let backup = dir.join(format!("before-migration-v{}-{}.sqlite3", version, stamp));
        db.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()]).map_err(|e|e.to_string())?;
        let verify = Connection::open_with_flags(&backup, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e|e.to_string())?;
        let check: String = verify.query_row("PRAGMA quick_check", [], |row| row.get(0)).map_err(|e|e.to_string())?;
        if check != "ok" { return Err("Backup before migration failed integrity verification".into()); }
    }
    for (number, sql) in MIGRATIONS {
        if *number > version {
            let tx = db.transaction().map_err(|e| e.to_string())?;
            tx.execute_batch(sql).map_err(|e| e.to_string())?;
            tx.pragma_update(None, "user_version", number).map_err(|e| e.to_string())?;
            tx.commit().map_err(|e| e.to_string())?;
        }
    }
    let integrity: String = db.query_row("PRAGMA quick_check", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if integrity != "ok" { return Err(format!("Database integrity error: {}", integrity)); }
    Ok(db)
}
#[derive(Serialize)]
pub struct DbSnapshot { revision: i64, tables: BTreeMap<String, Vec<Json>> }
#[derive(Deserialize)]
pub struct Mutation { table: String, id: String, row: Option<Map<String, Json>> }
fn read_selected(db: &Connection, selected: &[(&str, &[&str])], revision_sql: &str) -> Result<DbSnapshot, String> {
    let revision = db.query_row(revision_sql, [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let mut tables = BTreeMap::new();
    for (table, _) in selected {
        let mut statement = db.prepare(&format!("SELECT * FROM {}", table)).map_err(|e| e.to_string())?;
        let columns: Vec<String> = statement.column_names().iter().map(|s| s.to_string()).collect();
        let result = statement.query_map([], |row| {
            let mut object = Map::new();
            for (i, name) in columns.iter().enumerate() {
                let value = match row.get_ref(i)? {
                    ValueRef::Null => Json::Null,
                    ValueRef::Integer(n) => Json::from(n),
                    ValueRef::Real(n) => Json::from(n),
                    ValueRef::Text(s) => Json::String(String::from_utf8_lossy(s).to_string()),
                    ValueRef::Blob(_) => return Err(rusqlite::Error::InvalidColumnType(i, name.clone(), rusqlite::types::Type::Blob)),
                };
                object.insert(name.clone(), value);
            }
            Ok(Json::Object(object))
        }).map_err(|e| e.to_string())?;
        let rows: Result<Vec<_>, _> = result.collect();
        tables.insert(table.to_string(), rows.map_err(|e| e.to_string())?);
    }
    Ok(DbSnapshot { revision, tables })
}
fn read(db: &Connection) -> Result<DbSnapshot, String> {
    read_selected(db, TABLES, "SELECT revision FROM app_meta WHERE id=1")
}
fn read_bank(db: &Connection) -> Result<DbSnapshot, String> {
    read_selected(db, BANK_TABLES, "SELECT revision FROM question_bank_meta WHERE id=1")
}
fn commit_selected(db: &mut Connection, mutations: Vec<Mutation>, expected: i64, selected: &[(&str, &[&str])], meta_table: &str) -> Result<i64, String> {
    if mutations.len() > 400000 { return Err("Too many changes in one transaction".into()); }
    let tx = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(|e| e.to_string())?;
    let revision_sql = format!("SELECT revision FROM {} WHERE id=1", meta_table);
    let revision: i64 = tx.query_row(&revision_sql, [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if revision != expected { return Err("Dữ liệu đã thay đổi ở cửa sổ khác. Hãy tải lại trước khi tiếp tục.".into()); }
    tx.execute_batch("PRAGMA defer_foreign_keys=ON").map_err(|e| e.to_string())?;
    for mutation in mutations {
        let (_, allowed) = selected.iter().find(|(table, _)| *table == mutation.table).ok_or("Unsupported table")?;
        if let Some(row) = mutation.row {
            if row.len() != allowed.len() || row.keys().any(|key| !allowed.contains(&key.as_str())) || row.get("id").and_then(Json::as_str) != Some(mutation.id.as_str()) {
                return Err("Invalid database columns or id".into());
            }
            let columns: Vec<&str> = row.keys().map(String::as_str).collect();
            let parameters: Result<Vec<Value>, String> = row.values().map(|value| match value {
                Json::Null => Ok(Value::Null),
                Json::String(text) => Ok(Value::Text(text.clone())),
                Json::Number(number) => number.as_i64().map(Value::Integer).ok_or_else(|| "Only integer database numbers are supported".to_string()),
                _ => Err("Unsupported database value".to_string()),
            }).collect();
            let updates = columns.iter().filter(|key| **key != "id").map(|key| format!("{}=excluded.{}", key, key)).collect::<Vec<_>>().join(",");
            let sql = format!("INSERT INTO {} ({}) VALUES ({}) ON CONFLICT(id) DO UPDATE SET {}", mutation.table, columns.join(","), vec!["?"; columns.len()].join(","), updates);
            tx.execute(&sql, params_from_iter(parameters?)).map_err(|e| e.to_string())?;
        } else {
            tx.execute(&format!("DELETE FROM {} WHERE id=?", mutation.table), params![mutation.id]).map_err(|e| e.to_string())?;
        }
    }
    tx.execute(&format!("UPDATE {} SET revision=revision+1 WHERE id=1", meta_table), []).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(revision + 1)
}
fn commit(db: &mut Connection, mutations: Vec<Mutation>, expected: i64) -> Result<i64, String> {
    if mutations.len() > 400000 { return Err("Too many changes in one transaction".into()); }
    let tx = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(|e|e.to_string())?;
    let revision: i64 = tx.query_row("SELECT revision FROM app_meta WHERE id=1", [], |r|r.get(0)).map_err(|e|e.to_string())?;
    if revision != expected { return Err("Dữ liệu đã thay đổi ở cửa sổ khác. Hãy tải lại trước khi tiếp tục.".into()); }
    tx.execute_batch("PRAGMA defer_foreign_keys=ON").map_err(|e|e.to_string())?;
    for m in &mutations {
        if m.table == "schedule_exceptions" && m.row.is_some() { tx.execute("DELETE FROM schedule_exceptions WHERE id=?", params![m.id]).map_err(|e|e.to_string())?; }
    }
    for m in mutations {
        let (_, allowed) = TABLES.iter().find(|(t,_)|*t == m.table).ok_or("Unsupported table")?;
        if let Some(row) = m.row {
            if row.len() != allowed.len() || row.keys().any(|k|!allowed.contains(&k.as_str())) || row.get("id").and_then(Json::as_str) != Some(m.id.as_str()) { return Err("Invalid database columns or id".into()); }
            let columns: Vec<&str> = row.keys().map(String::as_str).collect();
            let parameters: Result<Vec<Value>, String> = row.values().map(|v|match v {
                Json::Null => Ok(Value::Null),
                Json::String(s) => Ok(Value::Text(s.clone())),
                Json::Number(n) => n.as_i64().map(Value::Integer).ok_or_else(||"Only integer database numbers are supported".to_string()),
                _ => Err("Unsupported database value".to_string()),
            }).collect();
            let updates = columns.iter().filter(|k|**k != "id").map(|k|format!("{}=excluded.{}",k,k)).collect::<Vec<_>>().join(",");
            let sql = format!("INSERT INTO {} ({}) VALUES ({}) ON CONFLICT(id) DO UPDATE SET {}", m.table, columns.join(","), vec!["?";columns.len()].join(","), updates);
            tx.execute(&sql, params_from_iter(parameters?)).map_err(|e|e.to_string())?;
        } else { tx.execute(&format!("DELETE FROM {} WHERE id=?",m.table),params![m.id]).map_err(|e|e.to_string())?; }
    }
    tx.execute("UPDATE app_meta SET revision=revision+1 WHERE id=1",[]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e|e.to_string())?;
    Ok(revision+1)
}
#[tauri::command]
pub fn load_database(state: tauri::State<'_, DatabaseState>) -> Result<DbSnapshot, String> {
    let guard = state.0.lock().map_err(|_|"Database lock failed")?;
    read(guard.as_ref().map_err(Clone::clone)?)
}
#[tauri::command]
pub fn commit_database(state: tauri::State<'_, DatabaseState>, mutations: Vec<Mutation>, expected_revision: i64) -> Result<i64, String> {
    let mut guard = state.0.lock().map_err(|_|"Database lock failed")?;
    commit(guard.as_mut().map_err(|e|e.clone())?, mutations, expected_revision)
}
#[tauri::command]
pub fn load_question_bank(state: tauri::State<'_, DatabaseState>) -> Result<DbSnapshot, String> {
    let guard = state.0.lock().map_err(|_| "Database lock failed")?;
    read_bank(guard.as_ref().map_err(Clone::clone)?)
}
#[tauri::command]
pub fn commit_question_bank(state: tauri::State<'_, DatabaseState>, mutations: Vec<Mutation>, expected_revision: i64) -> Result<i64, String> {
    let mut guard = state.0.lock().map_err(|_| "Database lock failed")?;
    commit_selected(guard.as_mut().map_err(|error| error.clone())?, mutations, expected_revision, BANK_TABLES, "question_bank_meta")
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankSearchRequest { ordered_ids: Vec<String>, query: String, limit: u32, offset: u32 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BankSearchResult { revision: i64, total: usize, matched_ids: Vec<String>, page_ids: Vec<String> }
fn search_bank(db: &Connection, request: BankSearchRequest) -> Result<BankSearchResult, String> {
    if request.ordered_ids.len() > 100000 || request.query.chars().count() > 1000 || request.limit == 0 || request.limit > 200 || request.offset > 100000 || request.ordered_ids.iter().any(|id| id.is_empty() || id.chars().count() > 100) {
        return Err("Invalid search request".into());
    }
    if request.ordered_ids.iter().collect::<std::collections::BTreeSet<_>>().len() != request.ordered_ids.len() { return Err("Duplicate search IDs".into()); }
    let normalized = request.query.replace('đ', "d").replace('Đ', "D").to_lowercase();
    let words: Vec<&str> = normalized.split(|c: char| !c.is_alphanumeric()).filter(|s| !s.is_empty()).collect();
    if words.len() > 20 || words.iter().any(|w| w.chars().count() > 100) { return Err("Search supports at most 20 words of 100 characters".into()); }
    let expression = words.iter().map(|w| format!("\"{}*\"", w)).collect::<Vec<_>>().join(" AND ");
    let mut parameters = vec![Value::Text(serde_json::to_string(&request.ordered_ids).map_err(|e| e.to_string())?)];
    let mut sql = "SELECT q.id FROM questions q JOIN json_each(?) AS selected ON selected.value=q.id WHERE q.deleted_at IS NULL".to_string();
    if !expression.is_empty() {
        sql.push_str(" AND q.rowid IN (SELECT docid FROM question_search WHERE question_search MATCH ?)");
        parameters.push(Value::Text(expression));
    }
    sql.push_str(" ORDER BY CAST(selected.key AS INTEGER)");
    let matched_ids = db.prepare(&sql).map_err(|e|e.to_string())?.query_map(params_from_iter(parameters.iter()), |row| row.get::<_, String>(0)).map_err(|e|e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e|e.to_string())?;
    parameters.push(Value::Integer(request.limit as i64));
    parameters.push(Value::Integer(request.offset as i64));
    let page_ids = db.prepare(&(sql + " LIMIT ? OFFSET ?")).map_err(|e|e.to_string())?.query_map(params_from_iter(parameters.iter()), |row| row.get::<_, String>(0)).map_err(|e|e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e|e.to_string())?;
    let revision = db.query_row("SELECT revision FROM question_bank_meta WHERE id=1", [], |row|row.get(0)).map_err(|e|e.to_string())?;
    Ok(BankSearchResult { revision, total: matched_ids.len(), matched_ids, page_ids })
}
#[tauri::command]
pub fn search_question_bank(state: tauri::State<'_, DatabaseState>, request: BankSearchRequest) -> Result<BankSearchResult, String> {
    let guard = state.0.lock().map_err(|_| "Database lock failed")?;
    search_bank(guard.as_ref().map_err(Clone::clone)?, request)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn full_text_search_and_paging_preserve_sources() {
        let db = open(Path::new(":memory:")).unwrap();
        for id in ["a", "b", "c"] {
            db.execute("INSERT INTO questions(id,raw_source,normalized_source,content_hash,question_type,level,status,created_at,updated_at) VALUES(?1,'Đạo hàm hàm số','x',?1,'essay','N','draft','2026-10-17','2026-10-17')", [id]).unwrap();
        }
        let found = search_bank(&db, BankSearchRequest { ordered_ids: vec!["c".into(), "b".into(), "a".into()], query: "dao ham".into(), limit: 1, offset: 1 }).unwrap();
        assert_eq!(found.total, 3); assert_eq!(found.page_ids, vec!["b"]);
        db.execute("UPDATE questions SET raw_source='Xác suất' WHERE id='b'", []).unwrap();
        let found = search_bank(&db, BankSearchRequest { ordered_ids: vec!["c".into(), "b".into(), "a".into()], query: "dao ham".into(), limit: 10, offset: 0 }).unwrap();
        assert_eq!(found.matched_ids, vec!["c", "a"]);
    }
    #[test]
    fn asset_tag_and_import_metadata_roundtrip() {
        let mut db = open(Path::new(":memory:")).unwrap();
        db.execute("INSERT INTO questions(id,raw_source,normalized_source,content_hash,question_type,level,status,created_at,updated_at) VALUES('q','Original','x','x','essay','N','draft','2026-10-17','2026-10-17')", []).unwrap();
        let metadata = [
            ("question_tags", serde_json::json!({"id":"tag", "name":"Geometry", "color":"", "created_at":"2026-10-17"})),
            ("question_assets", serde_json::json!({"id":"asset", "question_id":"q", "name":"figure.png", "relative_path":"figure.png", "mime_type":"image/png", "checksum":"", "missing":1, "created_at":"2026-10-17"})),
            ("import_jobs", serde_json::json!({"id":"job", "source_name":"input.tex", "status":"committed", "total_count":1, "imported_count":1, "error_json":"[]", "created_at":"2026-10-17", "updated_at":"2026-10-17"})),
        ];
        let mutations = metadata.into_iter().map(|(table, row)| Mutation { table:table.into(), id:row["id"].as_str().unwrap().into(), row:Some(row.as_object().unwrap().clone()) }).collect();
        assert_eq!(commit_selected(&mut db, mutations, 0, BANK_TABLES, "question_bank_meta").unwrap(), 1);
        let restored = read_bank(&db).unwrap();
        assert_eq!(restored.tables["question_assets"].len(), 1);
        assert_eq!(restored.tables["import_jobs"].len(), 1);
    }
    #[test]
    fn upgrades_a_v2_file_only_after_creating_a_restorable_backup() {
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("teacher-db-upgrade-{}", stamp));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("old.sqlite3");
        {
            let old = Connection::open(&path).unwrap();
            old.execute_batch(MIGRATIONS[0].1).unwrap(); old.execute_batch(MIGRATIONS[1].1).unwrap();
            old.pragma_update(None, "user_version", 2).unwrap();
            old.execute("INSERT INTO questions(id,raw_source,normalized_source,content_hash,question_type,level,status,created_at,updated_at) VALUES('q','Original source','x','x','essay','N','draft','2026-10-17','2026-10-17')", []).unwrap();
        }
        let upgraded = open(&path).unwrap();
        let backup = std::fs::read_dir(dir.join("backups")).unwrap().next().unwrap().unwrap().path();
        {
            let restored = Connection::open_with_flags(backup, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
            assert_eq!(restored.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0)).unwrap(), 2);
            assert_eq!(restored.query_row("SELECT raw_source FROM questions WHERE id='q'", [], |r| r.get::<_, String>(0)).unwrap(), "Original source");
        }
        assert_eq!(upgraded.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0)).unwrap(), 3);
        drop(upgraded); std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn migration_and_revision_guard() {
        let mut db = open(Path::new(":memory:")).unwrap();
        assert_eq!(read(&db).unwrap().revision,0);
        assert_eq!(commit(&mut db,vec![],0).unwrap(),1);
        assert!(commit(&mut db,vec![],0).is_err());
        assert_eq!(read(&db).unwrap().revision,1);
    }
    #[test]
    fn invalid_mutation_rolls_back() {
        let mut db = open(Path::new(":memory:")).unwrap();
        assert!(commit(&mut db,vec![Mutation {table:"arbitrary".into(),id:"a".into(),row:None}],0).is_err());
        assert_eq!(read(&db).unwrap().revision,0);
    }
}
