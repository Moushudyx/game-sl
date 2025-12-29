import { useState } from 'react'
import { BackupEntry, GameEntry, AppConfig } from '../../types'
import {
  backupGame,
  listBackups,
  updateBackupRemark,
  deleteBackup,
  restoreBackup,
  getBackupDir,
} from '../../services/tauri'
import { openPath } from '@tauri-apps/plugin-opener'
import type { ModalFuncProps } from 'antd'
import type { RestoreStepKey } from '../../components/RestoreOverlay'

/** 简化的消息接口，兼容 antd 的 message 实例 */
export interface MessageApiLike {
  success: (msg: string) => void
  error: (msg: string) => void
}

/**
 * 依赖注入：抽象外部服务，便于测试与复用
 */
export interface UseBackupsDeps {
  /** 更新配置（由后端返回的新配置对象） */
  setConfig: (cfg: AppConfig) => void
  /** 当前选择的 Steam UID（若无或非 Steam 游戏可为空） */
  selectedSteamUID?: string | null
  /** 将路径模板解析为字符串，供 UI 展示 */
  resolveTemplate: (template: string) => string
  /** 复原完成后刷新路径状态（建议返回 Promise 以便等待） */
  refreshPathState: () => Promise<void>
  /** 消息提示接口（成功/错误） */
  messageApi: MessageApiLike
  /** Modal 确认弹窗（兼容 antd 的 Modal.confirm） */
  modal: { confirm: (opts: ModalFuncProps) => void }
  /** 将错误文本解析为阶段与细节，便于展示 */
  parseRestoreError: (text: string) => { stage: RestoreStepKey | null; detail: string }
  /** 打开复原流程面板 */
  openRestoreOverlay: (gameName: string, backupName: string) => void
  /** 标记复原成功 */
  markRestoreSuccess: () => void
  /** 标记复原失败 */
  markRestoreFailure: (stage: RestoreStepKey | null, detail: string) => void
}

/** 返回值类型：统一暴露备份相关状态与操作 */
export interface UseBackupsReturn {
  // state
  backupModalOpen: boolean
  backupTarget: GameEntry | null
  backupListOpen: boolean
  backupListLoading: boolean
  backupList: BackupEntry[]
  backupListTarget: GameEntry | null
  editRemarkOpen: boolean
  editRemarkTarget: BackupEntry | null
  deletingBackupKey: string | null
  // actions
  openBackupModal: (game: GameEntry) => void
  closeBackupModal: () => void
  submitBackup: (remark: string) => Promise<void>
  openBackupList: (game: GameEntry) => Promise<void>
  closeBackupList: () => void
  openEditRemark: (item: BackupEntry) => void
  closeEditRemark: () => void
  submitEditRemark: (newRemark: string) => Promise<void>
  handleDeleteBackup: (item: BackupEntry) => void
  handleRestore: (item: BackupEntry) => void
  openBackupFolder: () => Promise<void>
  // helpers
  resolveTemplate: (template: string) => string
}

export function useBackups({
  setConfig,
  selectedSteamUID,
  resolveTemplate,
  refreshPathState,
  messageApi,
  modal,
  parseRestoreError,
  openRestoreOverlay,
  markRestoreSuccess,
  markRestoreFailure,
}: UseBackupsDeps): UseBackupsReturn {
  const [backupModalOpen, setBackupModalOpen] = useState(false)
  const [backupTarget, setBackupTarget] = useState<GameEntry | null>(null)
  const [backupListOpen, setBackupListOpen] = useState(false)
  const [backupListLoading, setBackupListLoading] = useState(false)
  const [backupList, setBackupList] = useState<BackupEntry[]>([])
  const [backupListTarget, setBackupListTarget] = useState<GameEntry | null>(null)
  const [editRemarkOpen, setEditRemarkOpen] = useState(false)
  const [editRemarkTarget, setEditRemarkTarget] = useState<BackupEntry | null>(null)
  const [deletingBackupKey, setDeletingBackupKey] = useState<string | null>(null)

  const openBackupModal = (game: GameEntry) => {
    setBackupTarget(game)
    setBackupModalOpen(true)
  }

  const closeBackupModal = () => setBackupModalOpen(false)

  const submitBackup = async (remark: string) => {
    if (!backupTarget) return
    const payloadRemark = remark.trim()
    const result = await backupGame(
      backupTarget.name,
      backupTarget.path,
      selectedSteamUID ?? null,
      payloadRemark.length > 0 ? payloadRemark : null
    )
    setConfig(result.config)
    messageApi.success('备份完成')
    setBackupModalOpen(false)
  }

  const openBackupList = async (game: GameEntry) => {
    setBackupListTarget(game)
    setBackupList([])
    setBackupListOpen(true)
    setBackupListLoading(true)
    try {
      const list = await listBackups(game.name)
      setBackupList(list)
    } catch (err) {
      console.error(err)
      messageApi.error('读取备份列表失败，请稍后重试')
    } finally {
      setBackupListLoading(false)
    }
  }

  const closeBackupList = () => setBackupListOpen(false)

  const openEditRemark = (item: BackupEntry) => {
    setEditRemarkTarget(item)
    setEditRemarkOpen(true)
  }

  const closeEditRemark = () => setEditRemarkOpen(false)

  const submitEditRemark = async (newRemark: string) => {
    if (!backupListTarget || !editRemarkTarget) return
    await updateBackupRemark(backupListTarget.name, editRemarkTarget.fileName, newRemark)
    messageApi.success('备注已保存')
    setBackupList((prev) =>
      prev.map((b) => (b.fileName === editRemarkTarget.fileName ? { ...b, remark: newRemark } : b))
    )
    setEditRemarkOpen(false)
  }

  const performDeleteBackup = async (item: BackupEntry) => {
    if (!backupListTarget) return
    setDeletingBackupKey(item.fileName)
    try {
      await deleteBackup(backupListTarget.name, item.fileName)
      messageApi.success('已删除备份（已送回收站）')
      setBackupList((prev) => prev.filter((b) => b.fileName !== item.fileName))
    } catch (err: any) {
      messageApi.error(err?.toString?.() ?? '删除失败')
    } finally {
      setDeletingBackupKey(null)
    }
  }

  const handleDeleteBackup = (item: BackupEntry) => {
    if (!backupListTarget) return

    modal.confirm({
      title: `删除备份 ${item.fileName} ？`,
      content: '将移入回收站并同时删除同名备注文件，确认继续？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      centered: true,
      onOk: () => performDeleteBackup(item),
    })
  }

  const performRestore = async (item: BackupEntry) => {
    if (!backupListTarget) return

    openRestoreOverlay(backupListTarget.name, item.fileName)

    try {
      const res = await restoreBackup(
        backupListTarget.name,
        backupListTarget.path,
        item.filePath,
        selectedSteamUID ?? null
      )

      setConfig(res.config)
      markRestoreSuccess()
      messageApi.success('复原完成')
      refreshPathState()
    } catch (err: any) {
      const raw = err?.toString?.() ?? '复原失败'
      const { stage, detail } = parseRestoreError(raw)
      markRestoreFailure(stage, detail)
      messageApi.error(detail || '复原失败，请检查提示')
    }
  }

  const handleRestore = (item: BackupEntry) => {
    if (!backupListTarget) return

    modal.confirm({
      title: `确认复原 ${backupListTarget.name} ？`,
      content: '复原会删除当前存档并解压所选备份，建议确保备份可靠。',
      okText: '开始复原',
      okButtonProps: { danger: true },
      cancelText: '取消',
      centered: true,
      onOk: () => {
        performRestore(item)
      },
    })
  }

  const openBackupFolder = async () => {
    try {
      const dir = await getBackupDir()
      await openPath(dir)
    } catch (err) {
      console.error(err)
      messageApi.error('打开备份目录失败')
    }
  }

  return {
    // state
    backupModalOpen,
    backupTarget,
    backupListOpen,
    backupListLoading,
    backupList,
    backupListTarget,
    editRemarkOpen,
    editRemarkTarget,
    deletingBackupKey,
    // actions
    openBackupModal,
    closeBackupModal,
    submitBackup,
    openBackupList,
    closeBackupList,
    openEditRemark,
    closeEditRemark,
    submitEditRemark,
    handleDeleteBackup,
    handleRestore,
    openBackupFolder,
    // helpers
    resolveTemplate,
  }
}
