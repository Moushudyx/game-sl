mod backup;
mod commands;
pub mod config;
mod paths;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_config,
            commands::get_user_folder,
            commands::get_steam_install_dir,
            commands::get_steam_uid_list,
            commands::check_save_path,
            paths::resolve_template_path,
            commands::get_appdata_root_path,
            commands::backup_game,
            commands::list_backups,
            commands::restore_backup,
            commands::update_backup_remark,
            commands::get_backup_dir,
            commands::set_setting,
            commands::reorder_games
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
