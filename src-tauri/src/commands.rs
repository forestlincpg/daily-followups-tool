use rusqlite::params;
use std::fs;
use tauri::State;

use crate::db::DbState;
use crate::models::{CreateItemInput, FollowUpItem, GetItemsFilter, StatusHistoryEntry, UpdateItemInput};

// ─── 工具函数 ─────────────────────────────────────────────────────────────

/// 从数据库行构建 FollowUpItem（列顺序与 SELECT * 一致）
fn row_to_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<FollowUpItem> {
    Ok(FollowUpItem {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        title: row.get(2)?,
        status: row.get(3)?,
        waiting_for: row.get(4)?,
        waiting_since: row.get(5)?,
        owner: row.get(6)?,
        due_date: row.get(7)?,
        links: row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "[]".to_string()),
        is_emphasized: row.get::<_, i64>(9)? != 0,
        sort_order: row.get(10)?,
        notes: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
        completed_at: row.get(14)?,
    })
}

/// 根据 ID 查询单条记录（用于 create/update 后返回完整行）
fn fetch_item_by_id(conn: &rusqlite::Connection, id: i64) -> Result<FollowUpItem, String> {
    conn.query_row(
        "SELECT id, parent_id, title, status, waiting_for, waiting_since, owner,
                due_date, links, is_emphasized, sort_order, notes,
                created_at, updated_at, completed_at
         FROM follow_up_items WHERE id = ?1",
        params![id],
        row_to_item,
    )
    .map_err(|e| e.to_string())
}

// ─── Commands ────────────────────────────────────────────────────────────

/// 查询跟进项列表，支持按状态、父任务、截止日期过滤
#[tauri::command]
pub fn get_items(
    state: State<'_, DbState>,
    filter: GetItemsFilter,
) -> Result<Vec<FollowUpItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 动态构建 WHERE 子句
    let mut conditions: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(status) = &filter.status {
        conditions.push(format!("status = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(status.clone()));
    }

    // parent_id 过滤：None 时返回全部（含子任务和顶级），Some 时过滤
    if let Some(parent_id) = filter.parent_id {
        conditions.push(format!("parent_id = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(parent_id));
    } else if filter.include_children != Some(true) {
        // 默认只返回顶级任务（parent_id IS NULL）
        conditions.push("parent_id IS NULL".to_string());
    }

    if let Some(due_date_before) = &filter.due_date_before {
        conditions.push(format!(
            "(due_date IS NULL OR due_date <= ?{})",
            params_vec.len() + 1
        ));
        params_vec.push(Box::new(due_date_before.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, parent_id, title, status, waiting_for, waiting_since, owner,
                due_date, links, is_emphasized, sort_order, notes,
                created_at, updated_at, completed_at
         FROM follow_up_items
         {}
         ORDER BY sort_order ASC, created_at ASC",
        where_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let items = stmt
        .query_map(refs.as_slice(), row_to_item)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<FollowUpItem>>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

/// 创建新的跟进项或子任务
#[tauri::command]
pub fn create_item(
    state: State<'_, DbState>,
    input: CreateItemInput,
) -> Result<FollowUpItem, String> {
    // P4：title 边界校验（命令层防御，前端已有前置检查）
    if input.title.trim().is_empty() {
        return Err("title 不能为空".to_string());
    }
    if input.title.len() > 2000 {
        return Err("title 不能超过 2000 字符".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // sort_order 默认取当前最小值 - 1，保证新项排在最前
    let min_order: f64 = conn
        .query_row(
            "SELECT COALESCE(MIN(sort_order), 0) FROM follow_up_items WHERE parent_id IS ?1",
            params![input.parent_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    conn.execute(
        "INSERT INTO follow_up_items (parent_id, title, owner, due_date, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.parent_id, input.title, input.owner, input.due_date, min_order - 1000.0],
    )
    .map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();
    fetch_item_by_id(&conn, new_id)
}

/// 更新跟进项（仅更新传入的非 None 字段）
#[tauri::command]
pub fn update_item(
    state: State<'_, DbState>,
    input: UpdateItemInput,
) -> Result<FollowUpItem, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 动态构建 SET 子句
    let mut sets: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // 不可置空字段：Option<String>，None = 不更新
    macro_rules! add_field {
        ($field:expr, $val:expr) => {
            if let Some(v) = $val {
                sets.push(format!("{} = ?{}", $field, params_vec.len() + 1));
                params_vec.push(Box::new(v));
            }
        };
    }

    // 可置空字段：Option<Option<String>>，None = 不更新，Some(None)/Some("") = 置 NULL
    macro_rules! add_nullable_field {
        ($field:expr, $val:expr) => {
            if let Some(v) = $val {
                sets.push(format!("{} = ?{}", $field, params_vec.len() + 1));
                let db_val: Option<String> = v.filter(|s| !s.is_empty());
                params_vec.push(Box::new(db_val));
            }
        };
    }

    add_field!("title", input.title);
    add_nullable_field!("waiting_for", input.waiting_for);
    add_nullable_field!("waiting_since", input.waiting_since);
    add_nullable_field!("owner", input.owner);
    add_nullable_field!("due_date", input.due_date);
    add_field!("links", input.links);
    add_nullable_field!("notes", input.notes);

    // completed_at: 先保存是否由前端显式传入，再处理
    let has_explicit_completed_at = input.completed_at.is_some();
    add_nullable_field!("completed_at", input.completed_at);

    // 状态变更：记录历史 + 自动管理 completedAt
    let new_status = input.status.clone();
    if let Some(ref status) = new_status {
        // 查询旧状态
        let old_status: Option<String> = conn
            .query_row(
                "SELECT status FROM follow_up_items WHERE id = ?1",
                params![input.id],
                |row| row.get(0),
            )
            .ok();

        if old_status.as_deref() != Some(status.as_str()) {
            // 记录状态变更历史
            conn.execute(
                "INSERT INTO status_history (item_id, old_status, new_status) VALUES (?1, ?2, ?3)",
                params![input.id, old_status, status],
            )
            .map_err(|e| e.to_string())?;

            // done → 自动设置 completedAt（除非前端已显式传了）
            if status == "done" && !has_explicit_completed_at {
                sets.push("completed_at = datetime('now')".to_string());
            }
            // 从 done 变走 → 清除 completedAt
            if old_status.as_deref() == Some("done") && status != "done" && !has_explicit_completed_at {
                sets.push("completed_at = NULL".to_string());
            }
        }

        sets.push(format!("status = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(status.clone()));
    }

    if let Some(v) = input.is_emphasized {
        sets.push(format!("is_emphasized = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(v as i64));
    }

    if sets.is_empty() {
        return fetch_item_by_id(&conn, input.id);
    }

    // 自动更新 updated_at
    sets.push(format!(
        "updated_at = datetime('now') "
    ));

    let id_idx = params_vec.len() + 1;
    let sql = format!(
        "UPDATE follow_up_items SET {} WHERE id = ?{}",
        sets.join(", "),
        id_idx
    );
    params_vec.push(Box::new(input.id));

    let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, refs.as_slice())
        .map_err(|e| e.to_string())?;

    fetch_item_by_id(&conn, input.id)
}

/// 将子任务提升为主任务，或重新指定父任务（newParentId = None 表示提升为顶级）
#[tauri::command]
pub fn set_item_parent(
    state: State<'_, DbState>,
    id: i64,
    new_parent_id: Option<i64>,
) -> Result<FollowUpItem, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE follow_up_items SET parent_id = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_parent_id, id],
    )
    .map_err(|e| e.to_string())?;
    fetch_item_by_id(&conn, id)
}

/// 删除跟进项（ON DELETE CASCADE 自动删除所有子任务）
#[tauri::command]
pub fn delete_item(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM follow_up_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 查询跟进项的状态变更历史
#[tauri::command]
pub fn get_status_history(
    state: State<'_, DbState>,
    item_id: i64,
) -> Result<Vec<StatusHistoryEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, old_status, new_status, changed_at \
             FROM status_history WHERE item_id = ?1 ORDER BY changed_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![item_id], |row| {
            Ok(StatusHistoryEntry {
                id: row.get(0)?,
                item_id: row.get(1)?,
                old_status: row.get(2)?,
                new_status: row.get(3)?,
                changed_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<StatusHistoryEntry>>>()
        .map_err(|e| e.to_string())?;
    Ok(entries)
}

/// 更新跟进项的排序位置
#[tauri::command]
pub fn reorder_item(
    state: State<'_, DbState>,
    id: i64,
    new_sort_order: f64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE follow_up_items SET sort_order = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_sort_order, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 导出跟进项为 Markdown 格式（AI 友好的纯文本结构）
#[tauri::command]
pub fn export_markdown(
    state: State<'_, DbState>,
    date_from: Option<String>,
    date_to: Option<String>,
    status_filter: Option<String>,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut conditions = vec!["parent_id IS NULL".to_string()];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(s) = &status_filter {
        conditions.push(format!("status = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(s.clone()));
    }
    // P2：使用 date(...,'localtime') 将 UTC stored 的 created_at 转换为本地日期再比较，
    //     避免 UTC vs 本地日期串错位问题（如 UTC+8 时 00:00-07:59 创建的项被漏掉）
    if let Some(df) = &date_from {
        conditions.push(format!("date(created_at, 'localtime') >= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(df.clone()));
    }
    if let Some(dt) = &date_to {
        conditions.push(format!("date(created_at, 'localtime') <= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(dt.clone()));
    }

    let sql = format!(
        "SELECT id, parent_id, title, status, waiting_for, waiting_since, owner,
                due_date, links, is_emphasized, sort_order, notes,
                created_at, updated_at, completed_at
         FROM follow_up_items WHERE {}
         ORDER BY sort_order ASC",
        conditions.join(" AND ")
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let items: Vec<FollowUpItem> = stmt
        .query_map(refs.as_slice(), row_to_item)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    // 查询所有子任务（一次性批量查询）
    let children_sql =
        "SELECT id, parent_id, title, status, waiting_for, waiting_since, owner,
                due_date, links, is_emphasized, sort_order, notes,
                created_at, updated_at, completed_at
         FROM follow_up_items WHERE parent_id IS NOT NULL
         ORDER BY sort_order ASC";
    let mut child_stmt = conn.prepare(children_sql).map_err(|e| e.to_string())?;
    let all_children: Vec<FollowUpItem> = child_stmt
        .query_map([], row_to_item)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    // 构建 Markdown 字符串
    let mut md = String::from("# 跟进项导出\n\n");

    let status_label: fn(&str) -> &str = |s| match s {
        "todo" => "待办",
        "waiting" => "等待他人",
        "done" => "已完成",
        "long_term" => "长期跟进",
        _ => s,
    };

    for item in &items {
        let emphasis = if item.is_emphasized { "⭐ " } else { "" };
        let due = item
            .due_date
            .as_deref()
            .map(|d| format!(" · 截止: {}", d))
            .unwrap_or_default();
        let owner = item
            .owner
            .as_deref()
            .map(|o| format!(" · 负责: {}", o))
            .unwrap_or_default();
        let waiting = item
            .waiting_for
            .as_deref()
            .map(|w| format!(" · 等待: {}", w))
            .unwrap_or_default();

        md.push_str(&format!(
            "## {}[{}] {}{}{}{}\n\n",
            emphasis,
            status_label(&item.status),
            item.title,
            due,
            owner,
            waiting
        ));

        // P1：多行 notes 逐行加 '> ' 前缀，避免换行后脱离 blockquote
        if let Some(notes) = &item.notes {
            if !notes.is_empty() {
                let quoted: String = notes
                    .lines()
                    .map(|l| format!("> {}\n", l))
                    .collect();
                md.push_str(&quoted);
                md.push('\n');
            }
        }

        // 追加子任务
        let children: Vec<&FollowUpItem> = all_children
            .iter()
            .filter(|c| c.parent_id == Some(item.id))
            .collect();

        if !children.is_empty() {
            md.push_str("**子任务：**\n\n");
            for child in children {
                let child_due = child
                    .due_date
                    .as_deref()
                    .map(|d| format!(" ({d})"))
                    .unwrap_or_default();
                md.push_str(&format!(
                    "- [{}] {}{}\n",
                    status_label(&child.status),
                    child.title,
                    child_due
                ));
            }
            md.push('\n');
        }
    }

    Ok(md)
}

/// 将导出内容保存到指定文件路径
#[tauri::command]
pub fn save_export_file(content: String, file_path: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| e.to_string())
}

/// 在系统默认浏览器中打开超链接
#[tauri::command]
pub fn open_external_link(
    app_handle: tauri::AppHandle,
    url: String,
) -> Result<(), String> {
    // P3：仅允许 http/https scheme，防止 javascript: / file: 等恶意调用
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(format!("不允许的 URL scheme，仅支持 http/https: {}", url));
    }
    use tauri_plugin_opener::OpenerExt;
    app_handle
        .opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}
