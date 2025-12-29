use crate::config;
use crate::paths::resolve_template_path;
use chrono::{Local, NaiveDateTime, TimeZone};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{copy, Read, Write};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipWriter};
use zip::read::ZipArchive;

/// 备份操作返回的结构体
/// 包含生成的备份文件名与路径、时间戳、备注文件路径（如有）、以及更新后的配置
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResponse {
    pub file_name: String,
    pub file_path: String,
    pub timestamp: i64,
    pub remark_path: Option<String>,
    pub config: config::AppConfig,
}

/// 备份列表中的单项描述
/// `timestamp` 优先取文件名中的时间；读不到则取文件修改时间；都没有则为 `None`
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub file_name: String,
    pub file_path: String,
    pub timestamp: Option<i64>,
    pub remark: Option<String>,
    pub size: u64,
    pub time_source: String,
}

/// 复原操作的返回信息
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResponse {
    pub config: config::AppConfig,
    pub restored_path: String,
    pub backup_file: String,
    pub extra_backup_path: Option<String>,
    pub timestamp: i64,
}

/// 复原过程的阶段（用于错误定位）
#[derive(Clone, Copy)]
enum RestoreStage {
    Check,
    ExtraBackup,
    Delete,
    Extract,
    UpdateConfig,
}

impl RestoreStage {
    fn as_code(&self) -> &'static str {
        match self {
            RestoreStage::Check => "CHECK",
            RestoreStage::ExtraBackup => "EXTRA_BACKUP",
            RestoreStage::Delete => "DELETE",
            RestoreStage::Extract => "EXTRACT",
            RestoreStage::UpdateConfig => "UPDATE_CONFIG",
        }
    }
}

fn stage_err(stage: RestoreStage, msg: impl Into<String>) -> String {
    format!("[{}] {}", stage.as_code(), msg.into())
}

/// 获取/创建备份目录：软件工作目录下的 `backup`
pub fn backup_dir() -> Result<PathBuf, String> {
    let workdir = config::software_workdir()?;
    let dir = workdir.join("backup");
    fs::create_dir_all(&dir).map_err(|e| format!("创建备份目录失败: {e}"))?;
    Ok(dir)
}

/// 额外备份目录：软件工作目录下的 `extra-backup`
fn extra_backup_dir() -> Result<PathBuf, String> {
    let workdir = config::software_workdir()?;
    let dir = workdir.join("extra-backup");
    fs::create_dir_all(&dir).map_err(|e| format!("创建额外备份目录失败: {e}"))?;
    Ok(dir)
}

/// 过滤文件名中不允许的字符，避免生成非法路径
fn sanitize_filename(name: &str) -> String {
    let invalid = ["<", ">", ":", "\"", "|", "?", "*", "/", "\\"]; // TODO 我是否应该把加号减号也塞进去？
    let mut out = name.to_string();
    for ch in invalid {
        out = out.replace(ch, "_");
    }
    out.trim().trim_matches('.').to_string()
}

/// 当前时间：返回用于文件名的标签（YYYYMMDD-HHMMSS）与毫秒时间戳（用于记录最后备份时间）
fn now_timestamp() -> (String, i64) {
    let now = Local::now();
    (
        now.format("%Y%m%d-%H%M%S").to_string(),
        now.timestamp_millis(),
    )
}

/// 将整个目录压缩为 .zip 文件
/// 先使用 .zip；直接引入一个 7z 的包感觉有点太重了，，，暂时也不考虑调用外部 7z.exe
fn zip_directory(src_dir: &Path, dest: &Path) -> Result<(), String> {
    let file = File::create(dest).map_err(|e| format!("创建备份文件失败: {e}"))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
    let mut buffer = Vec::new();

    for entry in WalkDir::new(src_dir) {
        let entry = entry.map_err(|e| format!("遍历备份目录失败: {e}"))?;
        let path = entry.path();
        let relative = path
            .strip_prefix(src_dir)
            .map_err(|e| format!("路径处理失败: {e}"))?;

        if relative.as_os_str().is_empty() {
            continue;
        }

        let name = relative.to_string_lossy().replace('\\', "/");
        if path.is_file() {
            // 感谢 AI 不然我真不会写 rust
            zip.start_file(name, options)
                .map_err(|e| format!("写入文件到备份包失败: {e}"))?;
            let mut f = File::open(path).map_err(|e| format!("读取文件失败: {e}"))?;
            f.read_to_end(&mut buffer)
                .map_err(|e| format!("读取文件内容失败: {e}"))?;
            zip.write_all(&buffer)
                .map_err(|e| format!("写入压缩内容失败: {e}"))?;
            buffer.clear();
        } else if path.is_dir() {
            let dir_name = format!("{}/", name.trim_end_matches('/'));
            zip.add_directory(dir_name, options)
                .map_err(|e| format!("写入目录到备份包失败: {e}"))?;
        }
    }

    zip.finish().map_err(|e| format!("完成压缩失败: {e}"))?;
    Ok(())
}

/// 将 zip 文件解压到目标目录（会按需创建子目录）
fn unzip_directory(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| format!("读取备份文件失败: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 Zip 失败: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("读取压缩条目失败: {e}"))?;
        let out_path = dest_dir.join(entry.mangled_name());

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("创建目录失败: {e}"))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建父目录失败: {e}"))?;
        }

        let mut outfile = File::create(&out_path)
            .map_err(|e| format!("写出文件失败: {e}"))?;
        copy(&mut entry, &mut outfile)
            .map_err(|e| format!("解压写入失败: {e}"))?;
    }

    Ok(())
}

/// 从备份文件名中解析时间戳：{游戏名}-Backup-YYYYMMDD-HHMMSS.ext
fn parse_timestamp_from_name(name: &str) -> Option<i64> {
    // {Game}-Backup-YYYYMMDD-HHMMSS.ext
    let parts: Vec<&str> = name.split("-Backup-").collect();
    let ts_part = parts.get(1)?.split('.').next()?;
    let dt = NaiveDateTime::parse_from_str(ts_part, "%Y%m%d-%H%M%S").ok()?;
    let local = Local.from_local_datetime(&dt).single()?;
    Some(local.timestamp_millis())
}

/// 读取文件的最后修改时间（毫秒）作为兜底时间戳
fn file_modified_millis(path: &Path) -> Option<i64> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let duration = modified.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as i64)
}

/// 备份：解析模板路径、压缩存档目录、写备注文件（可选）、更新配置中的最后备份时间 lastSave
pub fn perform_backup(
    game_name: String,
    path_template: String,
    steam_uid: Option<String>,
    remark: Option<String>,
) -> Result<BackupResponse, String> {
    let source_path = resolve_template_path(path_template, steam_uid)?;
    if !source_path.exists() {
        return Err("存档路径不存在，无法备份".to_string());
    }

    let target_dir = backup_dir()?;
    let safe_name = sanitize_filename(&game_name);
    let (ts_tag, ts_millis) = now_timestamp();
    let file_stem = format!("{safe_name}-Backup-{ts_tag}");
    let archive_path = target_dir.join(format!("{file_stem}.zip"));

    zip_directory(&source_path, &archive_path)?;

    let mut remark_path: Option<String> = None;
    if let Some(text) = remark {
        let note_path = target_dir.join(format!("{file_stem}.txt"));
        fs::write(&note_path, text).map_err(|e| format!("写入备注失败: {e}"))?;
        remark_path = Some(note_path.to_string_lossy().to_string());
    }

    let config = config::update_last_save(&game_name, ts_millis)?;

    Ok(BackupResponse {
        file_name: format!("{file_stem}.zip"),
        file_path: archive_path.to_string_lossy().to_string(),
        timestamp: ts_millis,
        remark_path,
        config,
    })
}

/// 列出指定游戏的备份文件（目前考虑 .zip/.7z），并尝试读取备注与时间信息
pub fn list_backups(game_name: String) -> Result<Vec<BackupEntry>, String> {
    let dir = backup_dir()?;
    let filename_prefix = format!("{}-Backup", sanitize_filename(&game_name));
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    let mut backups = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            // 所以这里为啥会有文件夹啊喂
            continue;
        }

        let file_name = if let Some(n) = path.file_name().and_then(|s| s.to_str()) {
            n.to_string()
        } else {
            continue;
        };

        if !(file_name.ends_with(".zip") || file_name.ends_with(".7z")) {
            continue;
        }

        if !file_name.starts_with(&filename_prefix) {
            continue;
        }

        let timestamp = parse_timestamp_from_name(&file_name);
        let remark_path = path.with_extension("txt");
        let remark = if remark_path.exists() {
            fs::read_to_string(&remark_path).ok()
        } else {
            None
        };
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        let time_source = if timestamp.is_some() {
            "file-name".to_string()
        } else if file_modified_millis(&path).is_some() {
            "modified-time".to_string()
        } else {
            "unknown".to_string()
        };

        let fallback_ts = timestamp.or_else(|| file_modified_millis(&path));

        backups.push(BackupEntry {
            file_name: file_name.clone(),
            file_path: path.to_string_lossy().to_string(),
            timestamp: fallback_ts,
            remark,
            size,
            time_source,
        });
    }

    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(backups)
}

/// 更新（或删除）指定备份文件的备注：备注存储在同名 .txt 文件
pub fn update_backup_remark(
    game_name: String,
    file_name: String,
    remark: String,
) -> Result<(), String> {
    let dir = backup_dir()?;
    let filename_prefix = format!("{}-Backup", sanitize_filename(&game_name));

    if !file_name.starts_with(&filename_prefix) {
        return Err("文件名与游戏不匹配".to_string());
    }

    let archive_path = dir.join(&file_name);
    if !archive_path.exists() {
        return Err("未找到对应的备份文件".to_string());
    }

    let note_path = archive_path.with_extension("txt");
    if remark.trim().is_empty() {
        if note_path.exists() {
            fs::remove_file(&note_path).map_err(|e| format!("删除旧备注失败: {e}"))?;
        }
        return Ok(());
    }

    fs::write(&note_path, remark).map_err(|e| format!("写入备注失败: {e}"))
}

/// 复原备份：可选生成额外备份，移除原存档后解压备份文件
pub fn restore_backup(
    game_name: String,
    path_template: String,
    backup_path: String,
    steam_uid: Option<String>,
) -> Result<RestoreResponse, String> {
    let backup_file = PathBuf::from(&backup_path);
    if !backup_file.exists() {
        return Err(stage_err(RestoreStage::Check, "备份文件不存在"));
    }

    // 目前仅支持 zip 解压，7z 需要另行实现
    if let Some(ext) = backup_file.extension().and_then(|s| s.to_str()) {
        if !ext.eq_ignore_ascii_case("zip") {
            return Err(stage_err(RestoreStage::Check, "当前仅支持 .zip 备份文件"));
        }
    } else {
        return Err(stage_err(RestoreStage::Check, "无法识别的备份文件扩展名"));
    }

    let target_path = resolve_template_path(path_template, steam_uid)
        .map_err(|e| stage_err(RestoreStage::Check, e))?;

    // 读取设置，决定是否额外备份
    let config_snapshot = config::read_config()
        .map_err(|e| stage_err(RestoreStage::Check, e))?;
    let extra_backup_enabled = config_snapshot
        .settings
        .get("restoreExtraBackup")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let mut extra_backup_path: Option<PathBuf> = None;

    // 生成额外备份（仅当配置开启且目标目录存在时执行）
    if extra_backup_enabled && target_path.exists() {
        let dir = extra_backup_dir().map_err(|e| stage_err(RestoreStage::ExtraBackup, e))?;
        let safe_name = sanitize_filename(&game_name);
        let (ts_tag, _) = now_timestamp();
        let stem = format!("{safe_name}-ExtraBackup-{ts_tag}");
        let archive_path = dir.join(format!("{stem}.zip"));

        zip_directory(&target_path, &archive_path)
            .map_err(|e| stage_err(RestoreStage::ExtraBackup, e))?;

        // 顺便写一份简短的说明，便于用户识别
        let note_path = archive_path.with_extension("txt");
        let _ = fs::write(
            &note_path,
            "复原前自动生成的额外备份（解压后可恢复到复原前状态）",
        );

        extra_backup_path = Some(archive_path);
    }

    // 将原存档移入回收站（避免误删）
    if target_path.exists() {
        trash::delete(&target_path).map_err(|e| {
            stage_err(
                RestoreStage::Delete,
                format!("将原存档移入回收站失败: {e}"),
            )
        })?;
    }

    // 确保目标目录存在
    fs::create_dir_all(&target_path)
        .map_err(|e| stage_err(RestoreStage::Extract, format!("创建目标目录失败: {e}")))?;

    // 解压备份；失败时尝试用额外备份回滚
    if let Err(e) = unzip_directory(&backup_file, &target_path) {
        // 清理可能的半成品
        let _ = fs::remove_dir_all(&target_path);

        if let Some(extra) = &extra_backup_path {
            let _ = fs::create_dir_all(&target_path);
            let _ = unzip_directory(extra, &target_path);
        }

        return Err(stage_err(RestoreStage::Extract, e));
    }

    let ts = parse_timestamp_from_name(
        backup_file
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(""),
    )
    .or_else(|| file_modified_millis(&backup_file))
    .unwrap_or_else(|| chrono::Local::now().timestamp_millis());

    let config = config::update_last_save(&game_name, ts)
        .map_err(|e| stage_err(RestoreStage::UpdateConfig, e))?;

    Ok(RestoreResponse {
        config,
        restored_path: target_path.to_string_lossy().to_string(),
        backup_file: backup_file.to_string_lossy().to_string(),
        extra_backup_path: extra_backup_path.map(|p| p.to_string_lossy().to_string()),
        timestamp: ts,
    })
}
