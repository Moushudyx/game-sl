use serde::{Deserialize, Serialize};
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

// 获取当前可读写的工作目录（软件同级目录下的 game-sl）
pub fn software_workdir() -> Result<PathBuf, String> {
    let exe_path = env::current_exe().map_err(|e| format!("无法获取程序路径: {e}"))?;
    let base_dir = exe_path
        .parent()
        .ok_or_else(|| "无法获取程序所在目录".to_string())?;
    let workdir = base_dir.join(WORK_DIR_NAME);
    fs::create_dir_all(&workdir).map_err(|e| format!("创建工作目录失败: {e}"))?;
    Ok(workdir)
}

// 确保 config.json 存在，不存在则根据内置模板生成
fn ensure_config_file() -> Result<PathBuf, String> {
    let workdir = software_workdir()?;
    let config_path = workdir.join(CONFIG_FILE_NAME);
    if !config_path.exists() {
        fs::write(&config_path, DEFAULT_CONFIG)
            .map_err(|e| format!("写入默认配置失败: {e}"))?;
    }
    Ok(config_path)
}

// 读取配置，必要时创建默认文件
pub fn read_config() -> Result<AppConfig, String> {
    let config_path = ensure_config_file()?;
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {e}"))
}
