use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;
mod models;

/// 获取不会被僵尸进程锁定的 WebView2 数据目录
/// DEV 和 PROD 使用完全独立的目录，避免双开时互相抢锁导致键盘事件失效
fn webview_data_dir() -> std::path::PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("com.linc19.daily-followups");

    // debug 构建（pnpm tauri dev）用独立子目录，与生产版互不冲突
    #[cfg(debug_assertions)]
    let preferred = base.join("EBWebView_dev");
    #[cfg(not(debug_assertions))]
    let preferred = base.join("EBWebView");

    let lockfile = preferred.join("lockfile");

    // 如果 lockfile 存在且无法删除（被僵尸进程锁定），使用备用目录
    if lockfile.exists() {
        if std::fs::remove_file(&lockfile).is_err() {
            let alt_name = format!("{}_alt", preferred.file_name().unwrap().to_string_lossy());
            return base.join(alt_name);
        }
    }
    preferred
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let wv_data = webview_data_dir();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let conn = db::init_db(app.handle()).expect("数据库初始化失败");
            app.manage(db::DbState(Mutex::new(conn)));

            // 手动创建窗口，指定独立的 WebView2 data_directory
            let url = tauri::WebviewUrl::App("index.html".into());
            let title = if cfg!(debug_assertions) {
                "[DEV] Daily Follow-ups Tool"
            } else {
                "Daily Follow-ups Tool"
            };
            let _win = tauri::WebviewWindowBuilder::new(app, "main", url)
                .title(title)
                .inner_size(1024.0, 700.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .maximizable(true)
                .minimizable(true)
                .closable(true)
                .decorations(false)
                .center()
                .data_directory(wv_data)
                .build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_items,
            commands::create_item,
            commands::update_item,
            commands::delete_item,
            commands::reorder_item,
            commands::set_item_parent,
            commands::export_markdown,
            commands::save_export_file,
            commands::open_external_link,
            commands::get_status_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
