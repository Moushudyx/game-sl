use std::{env, fs, path::{Path, PathBuf}};
use tauri::command;

/// 统一路径分隔符（处理混用的 / 和 \ ）
/// 仅在 Windows 下使用，将所有分隔符规范为反斜杠。
fn normalize_path_separators<S: AsRef<str>>(s: S) -> String {
    let mut out = s.as_ref().replace('/', "\\");
    // 折叠连续的反斜杠（避免出现 \\\\ 这类情况）
    while out.contains("\\\\") {
        out = out.replace("\\\\", "\\");
    }
    out
}

/// 获取用户主目录 C:\\Users\\用户名\\
pub fn get_user_home() -> Result<String, String> {
    if let Ok(path) = env::var("USERPROFILE") {
        return Ok(normalize_path_separators(path));
    }
    env::var("HOME")
        .map(normalize_path_separators)
        .map_err(|_| "无法获取用户目录".to_string())
}

/// 获取 AppData 根路径（就是 Roaming/Local 的上一级）
pub fn get_appdata_root() -> Result<String, String> {
    if let Ok(roaming) = env::var("APPDATA") {
        if let Some(parent) = Path::new(&roaming).parent() {
            return Ok(normalize_path_separators(parent.to_string_lossy()));
        }
    }
    let home = get_user_home()?;
    Ok(normalize_path_separators(
        Path::new(&home)
            .join("AppData")
            .to_string_lossy()
    ))
}

/// 读取注册表获取 Steam 安装目录（仅 Windows）
#[cfg(target_os = "windows")]
pub fn get_steam_install_dir_internal() -> Result<String, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam = hkcu
        .open_subkey("Software\\Valve\\Steam")
        .map_err(|e| format!("无法读取 Steam 注册表项: {e}"))?;
    let path: String = steam
        .get_value("SteamPath")
        .map_err(|e| format!("无法读取 SteamPath: {e}"))?;
    Ok(normalize_path_separators(path))
}

// 如果我不编译到其他平台是不是就用不上这段？
#[cfg(not(target_os = "windows"))]
pub fn get_steam_install_dir_internal() -> Result<String, String> {
    Err("仅支持 Windows 平台".to_string())
}

/// 将模板路径中的占位符替换为实际路径
#[command]
pub fn resolve_template_path(template: String, steam_uid: Option<String>) -> Result<PathBuf, String> {
    let mut path_str = template.to_string();

    if path_str.contains("{Steam}") {
        let steam_dir = get_steam_install_dir_internal()?;
        path_str = path_str.replace("{Steam}", &steam_dir);
    }

    if path_str.contains("{SteamUID}") {
        if let Some(uid) = steam_uid {
            path_str = path_str.replace("{SteamUID}", &uid);
        } else {
            return Err("缺少 SteamUID 参数".to_string());
        }
    }

    if path_str.contains("{AppData}") {
        let appdata = get_appdata_root()?;
        path_str = path_str.replace("{AppData}", &appdata);
    }

    if path_str.contains("{User}") || path_str.contains("{Home}") {
        let home = get_user_home()?;
        path_str = path_str
            .replace("{User}", &home)
            .replace("{Home}", &home);
    }

    // 统一分隔符，避免出现混用的 / 与 \ 导致路径解析失败
    let normalized = normalize_path_separators(&path_str);
    Ok(PathBuf::from(normalized))
}

/// 列出 Steam UID 目录名（纯数字）
pub fn list_steam_uid() -> Vec<String> {
    // 失败场景直接返回空列表，避免层层嵌套
    let Ok(steam_dir) = get_steam_install_dir_internal() else {
        return Vec::new();
    };

    let userdata = Path::new(&steam_dir).join("userdata");
    let entries = match fs::read_dir(&userdata) {
        Ok(it) => it,
        Err(_) => return Vec::new(),
    };

    entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            // 只要目录且名称是纯数字（Steam UID）
            if !entry.file_type().ok()?.is_dir() {
                return None;
            }

            let name = entry.file_name();
            let name = name.to_str()?;
            name.chars().all(|c| c.is_ascii_digit()).then(|| name.to_string())
        })
        .collect()
}
