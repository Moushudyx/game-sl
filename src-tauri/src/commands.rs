use crate::config::read_config;
use crate::paths::{get_appdata_root, get_steam_install_dir_internal, get_user_home, list_steam_uid, resolve_template_path};
use tauri::command;

/// 读取配置
#[command]
pub fn load_config() -> Result<crate::config::AppConfig, String> {
    read_config()
}

/// 获取用户主目录
#[command]
pub fn get_user_folder() -> Result<String, String> {
    get_user_home()
}

/// 获取 Steam 安装目录（没有则返回 None）
#[command]
pub fn get_steam_install_dir() -> Result<Option<String>, String> {
    match get_steam_install_dir_internal() {
        Ok(path) => Ok(Some(path)),
        Err(_) => Ok(None),
    }
}

/// 获取 Steam UID 列表（没有则返回空数组）
#[command]
pub fn get_steam_uid_list() -> Result<Vec<String>, String> {
    Ok(list_steam_uid())
}

/// 检查存档路径是否存在，必要时替换占位符
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
