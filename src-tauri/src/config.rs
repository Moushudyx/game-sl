use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, fs, path::PathBuf};

const WORK_DIR_NAME: &str = "game-sl";
const CONFIG_FILE_NAME: &str = "config.json";
// 编译时内置默认配置，初始化时写入软件目录
const DEFAULT_CONFIG: &str = include_str!("default-config.json");

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub settings: serde_json::Value,
    pub games: Vec<GameEntry>,
    pub version: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameEntry {
    pub name: String,
    pub path: String,
    pub icon: String,
    #[serde(default)]
    pub last_save: Option<i64>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
}

/// 确保 settings 中存在默认值；返回是否有改动（需要写回文件）
fn ensure_settings_defaults(config: &mut AppConfig) -> bool {
    let mut changed = false;

    if !config.settings.is_object() {
        config.settings = serde_json::json!({});
        changed = true;
    }

    if let Some(map) = config.settings.as_object_mut() {
        if !map.contains_key("restoreExtraBackup") {
            map.insert("restoreExtraBackup".to_string(), serde_json::json!(true));
            changed = true;
        }

        // 默认启用相对时间，避免旧配置缺省时前端行为不一致
        if !map.contains_key("useRelativeTime") {
            map.insert("useRelativeTime".to_string(), serde_json::json!(true));
            changed = true;
        }
    }

    changed
}

/// 获取当前可读写的工作目录（软件同级目录下的 game-sl）
pub fn software_workdir() -> Result<PathBuf, String> {
    let exe_path = env::current_exe().map_err(|e| format!("无法获取程序路径: {e}"))?;
    let base_dir = exe_path
        .parent()
        .ok_or_else(|| "无法获取程序所在目录".to_string())?;
    let workdir = base_dir.join(WORK_DIR_NAME);
    fs::create_dir_all(&workdir).map_err(|e| format!("创建工作目录失败: {e}"))?;
    Ok(workdir)
}

/// 确保 config.json 存在，不存在则根据内置模板生成
fn ensure_config_file() -> Result<PathBuf, String> {
    let workdir = software_workdir()?;
    let config_path = workdir.join(CONFIG_FILE_NAME);
    if !config_path.exists() {
        fs::write(&config_path, DEFAULT_CONFIG)
            .map_err(|e| format!("写入默认配置失败: {e}"))?;
    }
    Ok(config_path)
}

/// 读取配置，必要时创建默认文件（如不存在则初始化默认配置）
pub fn read_config() -> Result<AppConfig, String> {
    let config_path = ensure_config_file()?;
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {e}"))?;
    let mut config: AppConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {e}"))?;

    // 自动补全缺省字段，保持旧配置向下兼容
    let mut changed = ensure_settings_defaults(&mut config);

    if changed {
        write_config(&config)?;
    }

    Ok(config)
}

/// 写回配置文件，保留格式化
pub fn write_config(config: &AppConfig) -> Result<(), String> {
    let config_path = ensure_config_file()?;
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {e}"))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置失败: {e}"))
}

/// 更新指定游戏的 last_save 并落盘，返回最新配置
pub fn update_last_save(game_name: &str, timestamp: i64) -> Result<AppConfig, String> {
    let mut config = read_config()?;
    let Some(entry) = config.games.iter_mut().find(|g| g.name == game_name) else {
        return Err("未找到对应的游戏配置".to_string());
    };

    entry.last_save = Some(timestamp);
    write_config(&config)?;
    Ok(config)
}

/// 更新 settings 中的单个键值并落盘，返回最新配置
pub fn update_setting(key: String, value: Value) -> Result<AppConfig, String> {
    let mut config = read_config()?;

    // 确保 settings 是对象
    if !config.settings.is_object() {
        config.settings = serde_json::json!({});
    }

    if let Some(map) = config.settings.as_object_mut() {
        map.insert(key, value);
    }

    write_config(&config)?;
    Ok(config)
}

/// 按名称顺序重排顺序并保存到 JSON，然后返回最新配置（省得前端调 load_config 再查一次）
pub fn reorder_games(order: Vec<String>) -> Result<AppConfig, String> {
    let mut config = read_config()?;
    let original = config.games.clone();

    use std::collections::HashMap; // 感谢 AI
    let mut by_name: HashMap<String, GameEntry> =
        config.games.into_iter().map(|g| (g.name.clone(), g)).collect();

    let mut new_games: Vec<GameEntry> = Vec::with_capacity(by_name.len());

    // 先按传入的顺序推进去
    for name in order {
        if let Some(entry) = by_name.remove(&name) {
            new_games.push(entry);
        }
    }

    // 再按原顺序补齐遗漏项，以防丢失配置
    for g in original {
        if let Some(entry) = by_name.remove(&g.name) {
            new_games.push(entry);
        }
    }

    config.games = new_games;
    write_config(&config)?;
    Ok(config)
}
