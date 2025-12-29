import { invoke } from '@tauri-apps/api/core'
import { AppConfig, BackupEntry, BackupResponse, RestoreResponse } from '../types'

export async function loadConfig(): Promise<AppConfig> {
  return invoke<AppConfig>('load_config')
}

export async function getUserFolder(): Promise<string> {
  return invoke<string>('get_user_folder')
}

export async function getSteamInstallDir(): Promise<string | null> {
  return invoke<string | null>('get_steam_install_dir')
}

export async function getSteamUIDList(): Promise<string[]> {
  return invoke<string[]>('get_steam_uid_list')
}

export async function checkSavePath(path: string, steamUid?: string | null): Promise<boolean> {
  return invoke<boolean>('check_save_path', { path, steamUid: steamUid ?? null })
}

export async function resolveTemplatePath(template: string, steamUid?: string | null): Promise<string> {
  // 返回解析后的绝对路径字符串（后端 PathBuf 会序列化为字符串）
  const resolved = await invoke<string>('resolve_template_path', { template, steamUid: steamUid ?? null })
  return resolved
}

export async function backupGame(
  gameName: string,
  pathTemplate: string,
  steamUid?: string | null,
  remark?: string | null
): Promise<BackupResponse> {
  return invoke<BackupResponse>('backup_game', {
    gameName,
    pathTemplate,
    steamUid: steamUid ?? null,
    remark: remark ?? null,
  })
}

export async function listBackups(gameName: string): Promise<BackupEntry[]> {
  return invoke<BackupEntry[]>('list_backups', { gameName })
}

export async function updateBackupRemark(gameName: string, fileName: string, remark: string): Promise<void> {
  await invoke('update_backup_remark', { gameName, fileName, remark })
}

export async function deleteBackup(gameName: string, fileName: string): Promise<void> {
  await invoke('delete_backup', { gameName, fileName })
}

export async function restoreBackup(
  gameName: string,
  pathTemplate: string,
  backupPath: string,
  steamUid?: string | null
): Promise<RestoreResponse> {
  return invoke<RestoreResponse>('restore_backup', { gameName, pathTemplate, backupPath, steamUid: steamUid ?? null })
}

export async function getBackupDir(): Promise<string> {
  return invoke<string>('get_backup_dir')
}

export async function setSetting(key: string, value: unknown): Promise<AppConfig> {
  return invoke<AppConfig>('set_setting', { key, value })
}

export async function reorderGames(order: string[]): Promise<AppConfig> {
  return invoke<AppConfig>('reorder_games', { order })
}
