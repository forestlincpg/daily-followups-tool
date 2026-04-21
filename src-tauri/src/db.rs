use rusqlite::Connection;
use std::fs;
use std::sync::Mutex;
use tauri::Manager;

/// 全局数据库状态，通过 Tauri 的 manage() 注入，在 commands 中通过 State<DbState> 访问。
pub struct DbState(pub Mutex<Connection>);

const CREATE_TABLE_SQL: &str = "
CREATE TABLE IF NOT EXISTS follow_up_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id     INTEGER REFERENCES follow_up_items(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'todo'
                CHECK(status IN ('todo', 'waiting', 'done', 'long_term')),
  waiting_for   TEXT,
  waiting_since DATETIME,
  owner         TEXT,
  due_date      DATE,
  links         TEXT DEFAULT '[]',
  is_emphasized BOOLEAN DEFAULT 0,
  sort_order    REAL NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at  DATETIME
);
";

const CREATE_STATUS_HISTORY_SQL: &str = "
CREATE TABLE IF NOT EXISTS status_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES follow_up_items(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
";

const CREATE_INDEXES_SQL: &[&str] = &[
    "CREATE INDEX IF NOT EXISTS idx_status ON follow_up_items(status);",
    "CREATE INDEX IF NOT EXISTS idx_parent ON follow_up_items(parent_id);",
    "CREATE INDEX IF NOT EXISTS idx_due_date ON follow_up_items(due_date);",
    "CREATE INDEX IF NOT EXISTS idx_sort_order ON follow_up_items(sort_order);",
    "CREATE INDEX IF NOT EXISTS idx_status_history_item ON status_history(item_id);",
];

/// 初始化数据库：创建数据目录、打开连接、执行 PRAGMA、建表建索引。
/// 返回已配置好的 Connection，供 AppState 持有。
pub fn init_db(app_handle: &tauri::AppHandle) -> rusqlite::Result<Connection> {
    // 获取平台数据目录（Windows: %APPDATA%\daily-followups-tool）
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("无法获取 app_data_dir");

    // 确保目录存在
    fs::create_dir_all(&data_dir).expect("无法创建数据目录");

    let db_path = data_dir.join("daily_followups.db");

    let conn = Connection::open(&db_path)?;

    // 启用 WAL 模式：提升并发读性能，保证崩溃安全
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // 启用外键约束（SQLite 默认关闭）
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // 建表（幂等）
    conn.execute_batch(CREATE_TABLE_SQL)?;
    conn.execute_batch(CREATE_STATUS_HISTORY_SQL)?;

    // 建索引（幂等）
    for sql in CREATE_INDEXES_SQL {
        conn.execute_batch(sql)?;
    }

    Ok(conn)
}

/// 内存 DB 初始化（测试专用）
#[allow(dead_code)]
pub fn init_in_memory() -> rusqlite::Result<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(CREATE_TABLE_SQL)?;    conn.execute_batch(CREATE_STATUS_HISTORY_SQL)?;    for sql in CREATE_INDEXES_SQL {
        conn.execute_batch(sql)?;
    }
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_creates_and_crud() {
        let conn = init_in_memory().expect("内存 DB 初始化失败");

        // 插入一条记录
        conn.execute(
            "INSERT INTO follow_up_items (title, status, sort_order) VALUES (?1, 'todo', 1.0)",
            rusqlite::params!["测试跟进项"],
        )
        .expect("insert 失败");

        // 验证可以查到
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM follow_up_items",
                [],
                |row| row.get(0),
            )
            .expect("count 失败");
        assert_eq!(count, 1, "应有 1 条记录");

        // 更新状态
        conn.execute(
            "UPDATE follow_up_items SET status = 'done' WHERE title = ?1",
            rusqlite::params!["测试跟进项"],
        )
        .expect("update 失败");

        // 验证状态已更新
        let status: String = conn
            .query_row(
                "SELECT status FROM follow_up_items WHERE title = ?1",
                rusqlite::params!["测试跟进项"],
                |row| row.get(0),
            )
            .expect("select 失败");
        assert_eq!(status, "done");

        // 删除
        conn.execute(
            "DELETE FROM follow_up_items WHERE title = ?1",
            rusqlite::params!["测试跟进项"],
        )
        .expect("delete 失败");

        let count_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM follow_up_items", [], |row| row.get(0))
            .expect("count after 失败");
        assert_eq!(count_after, 0, "删除后应为 0 条");
    }

    #[test]
    fn test_foreign_key_cascade_delete() {
        let conn = init_in_memory().expect("内存 DB 初始化失败");

        // 插入父项
        conn.execute(
            "INSERT INTO follow_up_items (title, status, sort_order) VALUES ('父项', 'todo', 1.0)",
            [],
        )
        .expect("parent insert 失败");
        let parent_id: i64 = conn.last_insert_rowid();

        // 插入子项
        conn.execute(
            "INSERT INTO follow_up_items (parent_id, title, status, sort_order) VALUES (?1, '子项', 'todo', 2.0)",
            rusqlite::params![parent_id],
        )
        .expect("child insert 失败");

        // 删除父项 → 子项应被级联删除
        conn.execute(
            "DELETE FROM follow_up_items WHERE id = ?1",
            rusqlite::params![parent_id],
        )
        .expect("parent delete 失败");

        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM follow_up_items", [], |row| row.get(0))
            .expect("count 失败");
        assert_eq!(remaining, 0, "父项删除后子项应被级联删除");
    }
}
