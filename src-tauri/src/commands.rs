use crate::backup;
use crate::config::{read_config, reorder_games as reorder_games_impl, update_setting};
use crate::paths::{get_appdata_root, get_steam_install_dir_internal, get_user_home, list_steam_uid, resolve_template_path};
use tauri::command;

/// 读取配置
#[command]
pub fn load_config() -> Result<crate::config::AppConfig, String> {
    read_config()
}

/// 获取用户主目录（取环境变量 USERPROFILE）
#[command]
pub fn get_user_folder() -> Result<String, String> {
    get_user_home()
}

/// 获取 Steam 安装目录（注册表 Software\Valve\Steam ，没有则返回 None）
#[command]
pub fn get_steam_install_dir() -> Result<Option<String>, String> {
    match get_steam_install_dir_internal() {
        Ok(path) => Ok(Some(path)),
        Err(_) => Ok(None),
    }
}

/// 获取 Steam UID 列表（失败返回空数组）
#[command]
pub fn get_steam_uid_list() -> Result<Vec<String>, String> {
    Ok(list_steam_uid())
}

/// 检查存档路径是否存在：支持占位符替换
#[command]
pub fn check_save_path(path: String, steam_uid: Option<String>) -> Result<bool, String> {
    if path.contains("{SteamUID}") && steam_uid.is_none() {
        return Ok(false);
    }

    let resolved = match resolve_template_path(path, steam_uid) {
        Ok(p) => p,
        Err(_) => return Ok(false),
    };

    Ok(resolved.exists())
}

/// 提供 AppData 根路径给前端（备用）
#[command]
pub fn get_appdata_root_path() -> Result<String, String> {
    get_appdata_root()
}

/// 备份指定游戏存档：压缩存档目录为 Zip，备注写同名 .txt，更新配置中的 lastSave 字段
#[command]
pub fn backup_game(
    game_name: String,
    path_template: String,
    steam_uid: Option<String>,
    remark: Option<String>,
) -> Result<backup::BackupResponse, String> {
    backup::perform_backup(game_name, path_template, steam_uid, remark)
}

/// 列出指定游戏的备份（自动读取备注与时间信息）
#[command]
pub fn list_backups(game_name: String) -> Result<Vec<backup::BackupEntry>, String> {
    backup::list_backups(game_name)
}

/// 更新备份备注（空字符串会删除备注文件）
#[command]
pub fn update_backup_remark(game_name: String, file_name: String, remark: String) -> Result<(), String> {
    backup::update_backup_remark(game_name, file_name, remark)
}

/// 返回备份目录路径
#[command]
pub fn get_backup_dir() -> Result<String, String> {
    backup::backup_dir().map(|p| p.to_string_lossy().to_string())
}

/// 更新 settings 中的单个键值
#[command]
pub fn set_setting(key: String, value: serde_json::Value) -> Result<crate::config::AppConfig, String> {
    update_setting(key, value)
}

/// 重排游戏顺序（写入 config.json）
#[command]
pub fn reorder_games(order: Vec<String>) -> Result<crate::config::AppConfig, String> {
    reorder_games_impl(order)
}
