use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;
mod models;

/// 获取不会被僵尸进程锁定的 WebView2 数据目录
fn webview_data_dir() -> std::path::PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("com.linc19.daily-followups");

    let preferred = base.join("EBWebView");
    let lockfile = preferred.join("lockfile");

    // 如果 lockfile 存在且无法删除（被僵尸进程锁定），使用备用目录
    if lockfile.exists() {
        if std::fs::remove_file(&lockfile).is_err() {
            return base.join("EBWebView_alt");
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
            let _win = tauri::WebviewWindowBuilder::new(app, "main", url)
                .title("Daily Follow-ups Tool")
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
